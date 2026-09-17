import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { listFilesViaGit, localHeadViaGit } from "@/lib/git/gitCli";
import { applyStructure, missingPaths, planStructureTask, readStructure, STRUCTURE_TASK_KEY, suggestAreas, type ProjectStructure, type StructureInput } from "@/lib/projectStructureLogic";
import { ensureCodeCopy } from "@/lib/git/codeCopy";
import { depsTaskAction, shortList } from "@/lib/git/depsTasksLogic";
import { pushTaskIssues } from "@/lib/git/issues";
import { logActivity } from "@/lib/activity";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { makeT } from "@/lib/i18n/messages";
import { dayKey, truncate } from "@/lib/utils";

// Projektaufbau (#101) mit Datenbank und lokaler Repository-Kopie.

/** Dateien der lokalen Kopie – null, wenn es (noch) keine gibt. */
async function repoFiles(projectId: string): Promise<string[] | null> {
  const cache = await db.repoCache.findUnique({ where: { projectId }, select: { defaultBranch: true } });
  const branch = cache?.defaultBranch ?? null;
  if (!branch || !(await localHeadViaGit(projectId, branch))) return null;
  return listFilesViaGit(projectId, branch);
}

export interface StructureView extends ProjectStructure {
  /** Pfade der Tabelle, die es im Repository nicht gibt */
  missingPaths: string[];
  /** Ordner aus dem Repository als Ausgangspunkt */
  suggestedAreas: Array<{ path: string; files: number }>;
  /** Gibt es eine lokale Kopie zum Abgleich? */
  checked: boolean;
}

export async function structureView(projectId: string): Promise<StructureView> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { structure: true } });
  const structure = readStructure(project?.structure);
  const files = await repoFiles(projectId).catch(() => null);
  return {
    ...structure,
    missingPaths: files ? missingPaths(structure.rows, files) : [],
    suggestedAreas: files ? suggestAreas(files) : [],
    checked: files !== null,
  };
}

export async function saveStructure(projectId: string, input: StructureInput, by: string): Promise<StructureView> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { structure: true } });
  let next: ProjectStructure;
  try {
    next = applyStructure(readStructure(project?.structure), input, by);
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Invalid structure");
  }
  await db.project.update({ where: { id: projectId }, data: { structure: next as unknown as Prisma.InputJsonValue } });
  // Aufbau-Wächter gleich nachziehen – stimmt die Tabelle jetzt, ist seine Aufgabe erledigt
  void syncStructureTask(projectId).catch((err) => console.error("[structure-watch]", projectId, err));
  return structureView(projectId);
}

/**
 * Aufbau-Wächter (#82): Tabelle gegen die lokale Kopie prüfen und die
 * Sammel-Aufgabe „Projektaufbau aktualisieren“ anlegen, anpassen oder
 * erledigen. Liefert, ob sich an der Aufgabe etwas geändert hat.
 */
async function syncStructureTask(projectId: string): Promise<boolean> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { structure: true, status: true, buriedAt: true, owner: { select: { locale: true } } } });
  if (!project || project.status === "ARCHIVED" || project.buriedAt) return false;
  const structure = readStructure(project.structure);
  if (!structure.rows.length) return false;
  const copy = await ensureCodeCopy(projectId);
  if (!copy.head) return false;
  const files = await listFilesViaGit(projectId, copy.branch);
  const t = makeT(project.owner.locale === "en" ? "en" : "de", "workflows");
  const plan = planStructureTask(structure, files, { missing: t("structure.watch.missing"), undocumented: t("structure.watch.undocumented") });
  if (!plan) return false;

  const title = t("structure.watch.title", { n: plan.names.length, list: shortList(plan.names) }).slice(0, 200);
  const description = `${t("structure.watch.intro")}\n\n${plan.lines.join("\n")}\n\n_${t("structure.watch.note")}_`;
  const task = await db.task.findUnique({ where: { projectId_autoKey: { projectId, autoKey: STRUCTURE_TASK_KEY } } });
  const action = depsTaskAction(task, { names: plan.names, description });
  let changed: string | null = null;
  if (action === "create") {
    const created = await db.task.create({
      data: { projectId, title, description, labels: [t("structure.watch.label")], autoKey: STRUCTURE_TASK_KEY, priority: 2, status: "TODO", position: await nextTaskPosition(db, projectId, "TODO"), createdVia: "auto" },
    });
    await logActivity({ projectId, userId: null, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(title, 60)}“ angelegt`, meta: { title: truncate(title, 60), taskId: created.id } });
    changed = created.id;
  } else if (action === "update") {
    await db.task.update({ where: { id: task!.id }, data: { title, description } });
    changed = task!.id;
  } else if (action === "reopen" || action === "close") {
    const to = action === "reopen" ? "TODO" : "DONE";
    await db.$transaction((tx) => transitionTask(tx, task!, to, null, { ...(action === "reopen" ? { title, description } : {}), position: 0 }));
    changed = task!.id;
  }
  if (!changed) return false;
  await syncProjectProgress(projectId);
  void pushTaskIssues([changed]).catch((err) => console.error("[structure-watch]", projectId, err));
  return true;
}

/** Einmal am Tag je Projekt mit Aufbau-Tabelle und Repository. */
export async function runStructureWatch(now = new Date()): Promise<number> {
  const today = dayKey(now);
  const projects = await db.project.findMany({
    where: {
      structure: { not: Prisma.AnyNull },
      repoUrl: { not: null },
      status: { not: "ARCHIVED" },
      buriedAt: null,
      OR: [{ structureCheckedOn: null }, { structureCheckedOn: { not: today } }],
    },
    select: { id: true },
  });
  let changed = 0;
  for (const p of projects) {
    await db.project.update({ where: { id: p.id }, data: { structureCheckedOn: today } });
    if (await syncStructureTask(p.id).catch((err) => (console.error("[structure-watch]", p.id, err), false))) changed++;
  }
  return changed;
}
