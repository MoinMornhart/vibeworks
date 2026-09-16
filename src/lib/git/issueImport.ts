import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
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
  const project = await db.project.findUnique({ where: { id: projectId }, select: { issueImport: true, gitPeople: true } });
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
    imported++;
  }
  if (imported) await syncProjectProgress(projectId);
  return imported;
}
