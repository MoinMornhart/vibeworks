import { Prisma, type Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { normalizeBoard } from "@/lib/boardConfig";

// Für KI gesperrte Bereiche (#76): einzelne Aufgaben (Task.aiLocked) oder ganze
// Spalten (boardConfig.aiLocked). Über MCP sind sie unsichtbar – Listen lassen
// sie weg, direkte Zugriffe melden „nicht gefunden“. Auch das Issue verrät nichts.

/** Gesperrte Spalten eines Projekts. */
export const aiLockedStatuses = (boardConfig: unknown) => normalizeBoard(boardConfig).aiLocked;

/** Ist diese Aufgabe für KI gesperrt – selbst oder über ihre Spalte? */
export function isAiLocked(task: Pick<Task, "aiLocked" | "status">, boardConfig: unknown): boolean {
  return task.aiLocked || aiLockedStatuses(boardConfig).includes(task.status);
}

/** Filter für Aufgaben-Abfragen über MCP: gesperrte Aufgaben und Spalten weglassen. */
export async function aiTaskFilter(userId: string): Promise<Prisma.TaskWhereInput> {
  const projects = await db.project.findMany({ where: { ...visibleTo(userId), boardConfig: { not: Prisma.DbNull } }, select: { id: true, boardConfig: true } });
  const locked = projects.map((p) => ({ projectId: p.id, statuses: aiLockedStatuses(p.boardConfig) })).filter((p) => p.statuses.length > 0);
  return {
    aiLocked: false,
    ...(locked.length ? { NOT: locked.map((p) => ({ projectId: p.projectId, status: { in: p.statuses } })) } : {}),
  };
}

/** Gesperrte Aufgabe eines Projekts? (lädt die Spalten-Einstellung nach) */
export async function taskIsAiLocked(task: Pick<Task, "aiLocked" | "status" | "projectId">): Promise<boolean> {
  if (task.aiLocked) return true;
  const project = await db.project.findUnique({ where: { id: task.projectId }, select: { boardConfig: true } });
  return isAiLocked(task, project?.boardConfig);
}
