import type { Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { displayNameOf } from "@/lib/auth/guard";
import { commitsForIssue, type CommitLike } from "./taskInfoLogic";

// Was im Info-Fenster einer Aufgabe steht (#48/#49): Verlauf, Schritte der KI,
// Commits zum Issue und erfasste Zeit. Nur für Leute mit Zugriff aufs Projekt.

export async function taskInfo(task: Task) {
  const [activity, calls, cache, entries] = await Promise.all([
    db.activity.findMany({
      where: { projectId: task.projectId, meta: { path: ["taskId"], equals: task.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { username: true, displayName: true } } },
    }),
    db.mcpCall.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { token: { select: { name: true, clientName: true } } },
    }),
    task.issueNumber ? db.repoCache.findUnique({ where: { projectId: task.projectId }, select: { commits: true } }) : null,
    db.timeEntry.findMany({
      where: { taskId: task.id },
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { user: { select: { username: true, displayName: true } } },
    }),
  ]);

  const callers = new Map(
    (await db.user.findMany({ where: { id: { in: [...new Set(calls.map((c) => c.userId))] } }, select: { id: true, username: true, displayName: true } })).map((u) => [u.id, displayNameOf(u)]),
  );
  const commits = commitsForIssue((cache?.commits as unknown as CommitLike[] | null) ?? [], task.issueNumber);
  const now = Date.now();
  const time = entries.map((e) => ({
    user: displayNameOf(e.user),
    startedAt: e.startedAt.toISOString(),
    running: !e.endedAt,
    seconds: e.endedAt ? e.seconds : Math.round((now - e.startedAt.getTime()) / 1000),
  }));

  return {
    status: task.status,
    since: task.statusChangedAt.toISOString(),
    assignee: task.assignee,
    priority: task.priority,
    aiNote: task.aiNote,
    issueUrl: task.issueUrl,
    activity: activity.map((a) => ({ at: a.createdAt.toISOString(), who: a.user ? displayNameOf(a.user) : null, kind: a.kind, summary: a.summary })),
    steps: calls.map((c) => ({
      at: c.createdAt.toISOString(),
      tool: c.tool,
      ok: c.ok,
      ms: c.ms,
      error: c.error,
      who: callers.get(c.userId) ?? null,
      client: c.token.clientName ?? c.token.name,
    })),
    commits: commits.map((c) => ({ sha: c.sha.slice(0, 7), title: c.title, author: c.author, date: c.date, url: c.url })),
    time,
    totalSeconds: time.reduce((sum, t) => sum + t.seconds, 0),
  };
}
export type TaskInfo = Awaited<ReturnType<typeof taskInfo>>;
