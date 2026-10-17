import { db } from "./db";
import { stampFrom } from "./projectStampLogic";

/**
 * Stempel über alles, was die Projektseite zeigt und sich im Hintergrund ändern
 * kann: Projekt, Aufgaben, Notizen, Kosten, Zeiten und der Repo-Stand. Aus dem
 * Repo-Zwischenspeicher nur kleine Werte – der neueste Commit statt des Abgleich-
 * zeitpunkts, sonst löste jeder Abgleich ohne Neues einen Neuaufbau aus.
 */
export async function projectStamp(projectId: string): Promise<string> {
  const [project, tasks, notes, costs, times, repo] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { updatedAt: true, liveError: true } }),
    db.task.aggregate({ where: { projectId }, _max: { updatedAt: true }, _count: true }),
    db.note.aggregate({ where: { projectId }, _max: { updatedAt: true }, _count: true }),
    db.projectCost.aggregate({ where: { projectId }, _max: { updatedAt: true }, _count: true }),
    db.timeEntry.aggregate({ where: { projectId }, _max: { startedAt: true, endedAt: true }, _count: true }),
    db.$queryRaw<Array<{ head: string | null; ci: string | null; error: string | null; checkStatus: string | null; checkFetchedAt: Date | null; depsCheckedAt: Date | null }>>`
      SELECT "commits"->0->>'sha' AS head, "ci"->>'state' AS ci, "error", "checkStatus", "checkFetchedAt", "depsCheckedAt"
      FROM "RepoCache" WHERE "projectId" = ${projectId}`,
  ]);
  const r = repo[0];
  return stampFrom([
    project?.updatedAt,
    project?.liveError,
    tasks._max.updatedAt,
    tasks._count,
    notes._max.updatedAt,
    notes._count,
    costs._max.updatedAt,
    costs._count,
    times._max.startedAt,
    times._max.endedAt,
    times._count,
    r?.head,
    r?.ci,
    r?.error,
    r?.checkStatus,
    r?.checkFetchedAt,
    r?.depsCheckedAt,
  ]);
}
