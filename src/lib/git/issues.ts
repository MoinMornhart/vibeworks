import type { Task, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { recurrenceLabel } from "@/lib/taskDates";
import { guessProvider, parseRepoUrl, type GitProvider } from "./parse";
import { GitError, issueApi, STATUS_LABELS, type IssueApi, type IssueInput, type IssueRef, type StatusLabel } from "./providers";

// Aufgaben ↔ Issues. Jede Aufgabe eines Projekts mit Repository und Token
// bekommt ein Issue; Titel, Text und Status folgen der Aufgabe:
//   Offen → offen · In Arbeit → offen + „in Arbeit“ · Blockiert → offen +
//   „blockiert“ · Erledigt → geschlossen.
// Umgekehrt sortiert der Abgleich Issues, die im Git-System geändert wurden
// (Label gesetzt, per „Fixes #12“ geschlossen …), in die passende Spalte –
// maßgeblich ist, wer zuletzt geändert hat.

const BACKFILL_LIMIT = 25;

/** Unsichtbare Markierung im Issue-Text – so ist jedes Issue seiner Aufgabe zuzuordnen. */
export const taskMarker = (taskId: string) => `<!-- vibeworks:task:${taskId} -->`;

export function issueBody(task: Pick<Task, "id" | "description" | "labels" | "dueDate" | "recurrence">): string {
  const meta: string[] = [];
  if (task.dueDate) meta.push(`📅 Fällig: ${task.dueDate.toISOString().slice(0, 10).split("-").reverse().join(".")}`);
  if (task.recurrence) meta.push(`🔁 ${recurrenceLabel(task.recurrence)}`);
  if (task.labels.length) meta.push(`🏷️ ${task.labels.join(", ")}`);
  return [task.description?.trim(), meta.join(" · "), "---", "_Aus VibeWorks gespiegelt – Änderungen bitte dort vornehmen._", taskMarker(task.id)]
    .filter(Boolean)
    .join("\n\n");
}

export function labelForStatus(status: TaskStatus): StatusLabel | null {
  return status === "DOING" ? STATUS_LABELS.DOING : status === "BLOCKED" ? STATUS_LABELS.BLOCKED : null;
}

export function statusFromIssue(issue: Pick<IssueRef, "closed" | "labels">): TaskStatus {
  if (issue.closed) return "DONE";
  const labels = issue.labels.map((l) => l.toLowerCase());
  if (labels.includes(STATUS_LABELS.BLOCKED.toLowerCase())) return "BLOCKED";
  if (labels.includes(STATUS_LABELS.DOING.toLowerCase())) return "DOING";
  return "TODO";
}

function describe(err: unknown): string {
  if (err instanceof GitError) {
    if (err.status === 403 || err.status === 404) return `${err.message} Das Token braucht Schreibrechte für Issues.`;
    return err.message;
  }
  return "Das Issue ließ sich nicht spiegeln.";
}

interface IssueContext {
  api: IssueApi;
  provider: GitProvider;
}

/** Null, wenn das Projekt keine Issues spiegelt (kein Repository, kein Token, abgeschaltet). */
export async function issueContext(projectId: string): Promise<IssueContext | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { repoUrl: true, repoTokenCipher: true, issueSync: true, repoCache: { select: { provider: true } } },
  });
  if (!project?.repoUrl || !project.repoTokenCipher || !project.issueSync) return null;
  const parsed = parseRepoUrl(project.repoUrl);
  const provider = (project.repoCache?.provider || guessProvider(parsed?.host ?? "")) as GitProvider | "";
  if (!parsed || !provider) return null; // Anbieter erst nach dem ersten Abgleich bekannt
  let token: string;
  try {
    token = decrypt(project.repoTokenCipher);
  } catch {
    return null;
  }
  return { api: issueApi(provider, parsed, token), provider };
}

const issueInput = (task: Task, reason?: IssueInput["reason"]): IssueInput => ({
  title: task.title,
  body: issueBody(task),
  closed: task.status === "DONE" || reason === "not_planned",
  reason: reason ?? (task.status === "DONE" ? "completed" : undefined),
});

// Ein Prozess, eine Warteschlange je Aufgabe: Anlegen nach dem Speichern und
// ein gleichzeitiger Abgleich dürfen nicht zwei Issues für dieselbe Aufgabe
// erzeugen.
const taskLocks = new Map<string, Promise<unknown>>();
function withTaskLock<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
  const prev = taskLocks.get(taskId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  taskLocks.set(taskId, tail);
  void tail.then(() => {
    if (taskLocks.get(taskId) === tail) taskLocks.delete(taskId);
  });
  return run;
}

/** Legt das Issue einer Aufgabe an oder bringt es auf ihren Stand. Wirft nie. */
export function pushTaskIssue(taskId: string, ctx?: IssueContext | null): Promise<void> {
  return withTaskLock(taskId, async () => {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return;
    ctx ??= await issueContext(task.projectId);
    if (!ctx) return;
    try {
      const ref = task.issueNumber ? await ctx.api.update(task.issueNumber, issueInput(task)) : await ctx.api.create(issueInput(task));
      // Sofort merken – falls das Label danach scheitert, entsteht kein zweites Issue.
      await db.$executeRaw`UPDATE "Task" SET "issueNumber" = ${ref.number}, "issueUrl" = ${ref.url}, "issueError" = NULL WHERE "id" = ${task.id}`;
      await ctx.api.setStatusLabel(ref, task.status === "DONE" ? null : labelForStatus(task.status));
    } catch (err) {
      await db.$executeRaw`UPDATE "Task" SET "issueError" = ${describe(err)} WHERE "id" = ${task.id}`;
    }
  });
}

export async function pushTaskIssues(taskIds: string[]): Promise<void> {
  if (!taskIds.length) return;
  const first = await db.task.findUnique({ where: { id: taskIds[0] }, select: { projectId: true } });
  const ctx = first && (await issueContext(first.projectId));
  if (!ctx) return;
  for (const id of taskIds) await pushTaskIssue(id, ctx);
}

/** Gelöschte Aufgabe: Issue als „nicht geplant“ schließen statt es stehen zu lassen. */
export async function closeIssueOfDeletedTask(projectId: string, task: Task): Promise<void> {
  if (!task.issueNumber) return;
  const ctx = await issueContext(projectId);
  if (!ctx) return;
  await ctx.api.update(task.issueNumber, issueInput(task, "not_planned")).catch(() => undefined);
}

export interface IssueSyncResult {
  created: number;
  tasksChanged: number;
  linked: number;
  error: string | null;
}

const running = new Map<string, Promise<IssueSyncResult | null>>();

/**
 * Voller Abgleich: offene Aufgaben ohne Issue nachtragen (höchstens 25 pro
 * Lauf) und im Git-System geänderte Issues in die passende Spalte sortieren.
 * Läuft je Projekt nur einmal gleichzeitig.
 */
export function syncIssues(projectId: string): Promise<IssueSyncResult | null> {
  const active = running.get(projectId);
  if (active) return active;
  const job = runSync(projectId).finally(() => running.delete(projectId));
  running.set(projectId, job);
  return job;
}

async function runSync(projectId: string): Promise<IssueSyncResult | null> {
  const ctx = await issueContext(projectId);
  if (!ctx) return null;
  const result: IssueSyncResult = { created: 0, tasksChanged: 0, linked: 0, error: null };

  const missing = await db.task.findMany({
    where: { projectId, issueNumber: null, status: { not: "DONE" } },
    orderBy: { createdAt: "asc" },
    take: BACKFILL_LIMIT,
    select: { id: true },
  });
  for (const { id } of missing) {
    await pushTaskIssue(id, ctx);
    const t = await db.task.findUnique({ where: { id }, select: { issueNumber: true, issueError: true } });
    if (t?.issueNumber) result.created++;
    else if (t?.issueError) {
      result.error = t.issueError;
      break; // Meist ein Rechteproblem – nicht 25-mal dasselbe versuchen
    }
  }

  try {
    const recent = await ctx.api.recent();
    const byNumber = new Map(recent.map((i) => [i.number, i]));
    const linked = await db.task.findMany({ where: { projectId, issueNumber: { in: [...byNumber.keys()] } } });
    for (const task of linked) {
      const issue = byNumber.get(task.issueNumber!)!;
      const target = statusFromIssue(issue);
      if (target === task.status) continue;
      // Nur übernehmen, wenn das Issue nach der Aufgabe geändert wurde –
      // sonst ist unsere eigene Änderung dort nur noch nicht angekommen.
      if (new Date(issue.updatedAt) <= task.updatedAt) continue;
      const position = await nextTaskPosition(db, projectId, target);
      await db.$transaction((tx) => transitionTask(tx, task, target, null, { position }));
      result.tasksChanged++;
    }
    if (result.tasksChanged) await syncProjectProgress(projectId);
  } catch (err) {
    result.error ??= describe(err);
  }
  result.linked = await db.task.count({ where: { projectId, issueNumber: { not: null } } });
  return result;
}
