import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { appLink, notifyUser } from "@/lib/notify";
import { nextTaskPosition, syncProjectProgress } from "@/lib/tasks";
import { truncate } from "@/lib/utils";
import type { IssueApi, IssueRef } from "./providers";
import { permissionOf } from "./botCommands";
import { fromVibeWorks, importDecision, isImportMode, MAX_IMPORT, normalizeGitPeople, roleOf, taskFromIssue, trustedAuthor } from "./issueImportLogic";

/**
 * Neue Issues aus dem Git-System als Aufgaben übernehmen (#69). Nur offene,
 * nicht von VibeWorks stammende Issues ohne Aufgabe; wer nicht vertrauenswürdig
 * ist, wird übersprungen oder – im Modus „alle“ – für KI gesperrt übernommen.
 */
export async function importNewIssues(projectId: string, api: IssueApi, recent: IssueRef[], botLogin: string | null): Promise<number> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { issueImport: true, gitPeople: true, name: true, ownerId: true } });
  const mode = isImportMode(project?.issueImport) ? project.issueImport : "trusted";
  if (!project || mode === "off") return 0;
  const own = botLogin?.toLowerCase() ?? null;
  const candidates = recent.filter((i) => !i.closed && i.author && i.author.toLowerCase() !== own && !i.author.endsWith("[bot]") && !fromVibeWorks(i.body));
  if (!candidates.length) return 0;
  const known = new Set(
    (await db.task.findMany({ where: { projectId, issueNumber: { in: candidates.map((i) => i.number) } }, select: { issueNumber: true } })).map((t) => t.issueNumber),
  );
  const people = normalizeGitPeople(project.gitPeople);
  let imported = 0;
  // Älteste zuerst, damit die Reihenfolge im Brett stimmt
  for (const issue of candidates.filter((i) => !known.has(i.number)).sort((a, b) => a.number - b.number).slice(0, MAX_IMPORT)) {
    const role = roleOf(people, issue.author);
    const trusted = trustedAuthor(role ? null : await permissionOf(api, projectId, issue.author), role);
    const decision = importDecision(mode, trusted);
    if (decision === "skip") continue;
    const data = taskFromIssue({ ...issue, title: issue.title, body: issue.body }, role, decision === "locked");
    const task = await db.task.create({
      data: { ...data, projectId, status: "TODO", position: await nextTaskPosition(db, projectId, "TODO"), createdVia: "issue" },
    });
    await logActivity({ projectId, userId: null, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(task.title, 60)}“ aus Issue #${issue.number} übernommen`, meta: { title: truncate(task.title, 60), taskId: task.id } });
    // Melden, damit ein neues Issue nicht unbemerkt im Brett landet (#109)
    await notifyUser(
      project.ownerId,
      "issueImported",
      (t) => ({
        event: "issueImported",
        title: t("events.issueImported.title", { number: issue.number, title: truncate(task.title, 60) }),
        message: t("events.issueImported.message", { author: issue.author, project: project.name, locked: decision === "locked" ? t("events.issueImported.locked") : "" }),
        url: appLink(`/projects/${projectId}?aufgabe=${task.id}#tasks`),
      }),
      { projectId, author: issue.author },
    );
    imported++;
  }
  if (imported) await syncProjectProgress(projectId);
  return imported;
}

/**
 * Übernommene Aufgaben nachziehen (#109): Wird das Issue im Git-System
 * geändert, folgen Titel, Text und Labels – VibeWorks schreibt bei diesen
 * Aufgaben ohnehin nichts zurück. Nur, wenn das Issue neuer ist als die Aufgabe.
 */
export async function refreshImportedTasks(projectId: string, recent: IssueRef[]): Promise<number> {
  const byNumber = new Map(recent.map((i) => [i.number, i]));
  if (!byNumber.size) return 0;
  const tasks = await db.task.findMany({ where: { projectId, createdVia: "issue", issueNumber: { in: [...byNumber.keys()] } } });
  let changed = 0;
  for (const task of tasks) {
    const issue = byNumber.get(task.issueNumber!)!;
    if (new Date(issue.updatedAt) <= task.updatedAt) continue;
    const next = taskFromIssue(issue, null, task.aiLocked);
    const labels = task.aiLocked ? next.labels : next.labels.filter((l) => l !== "extern");
    if (next.title === task.title && next.description === task.description && sameLabels(labels, task.labels)) continue;
    await db.task.update({ where: { id: task.id }, data: { title: next.title, description: next.description, labels } });
    changed++;
  }
  return changed;
}

const sameLabels = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
