import { Prisma, type Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { columnKeyOf, isExtraKey, normalizeBoard } from "@/lib/boardConfig";

// Für KI gesperrte Bereiche (#76): einzelne Aufgaben (Task.aiLocked) oder ganze
// Spalten (boardConfig.aiLocked, auch Zusatz-Spalten). Über MCP sind sie
// unsichtbar – Listen lassen sie weg, direkte Zugriffe melden „nicht gefunden“.
// Auch das Issue verrät nichts.

/** Gesperrte Spalten eines Projekts (Status oder Zusatz-Spalten). */
export const aiLockedStatuses = (boardConfig: unknown) => normalizeBoard(boardConfig).aiLocked;

/** Ist diese Aufgabe für KI gesperrt – selbst oder über ihre Spalte? */
export function isAiLocked(task: Pick<Task, "aiLocked" | "status"> & { column?: string | null }, boardConfig: unknown): boolean {
  if (task.aiLocked) return true;
  const cfg = normalizeBoard(boardConfig);
  return cfg.aiLocked.includes(columnKeyOf(cfg, task));
}

/** Bedingungen, die gesperrte Spalten eines Projekts beschreiben – für NOT in Abfragen. */
export function lockedColumnsWhere(projectId: string, boardConfig: unknown): Prisma.TaskWhereInput[] {
  const cfg = normalizeBoard(boardConfig);
  return cfg.aiLocked.map((key): Prisma.TaskWhereInput => {
    if (isExtraKey(key)) {
      const base = cfg.extra.find((x) => x.key === key)!.base;
      return { projectId, column: key, status: base };
    }
    // Grundspalte: alle mit diesem Status, die nicht in einer passenden Zusatz-Spalte stehen
    const own = cfg.extra.filter((x) => x.base === key).map((x) => x.key);
    return { projectId, status: key as Task["status"], ...(own.length ? { OR: [{ column: null }, { column: { notIn: own } }] } : {}) };
  });
}

/** Filter für Aufgaben eines Projekts über MCP. */
export function aiProjectTaskFilter(projectId: string, boardConfig: unknown): Prisma.TaskWhereInput {
  const locked = lockedColumnsWhere(projectId, boardConfig);
  return { aiLocked: false, ...(locked.length ? { NOT: locked } : {}) };
}

/** Filter für Aufgaben-Abfragen über MCP: gesperrte Aufgaben und Spalten weglassen. */
export async function aiTaskFilter(userId: string): Promise<Prisma.TaskWhereInput> {
  const projects = await db.project.findMany({ where: { ...visibleTo(userId), boardConfig: { not: Prisma.DbNull } }, select: { id: true, boardConfig: true } });
  const locked = projects.flatMap((p) => lockedColumnsWhere(p.id, p.boardConfig));
  return { aiLocked: false, ...(locked.length ? { NOT: locked } : {}) };
}

/** Gesperrte Aufgabe eines Projekts? (lädt die Spalten-Einstellung nach) */
export async function taskIsAiLocked(task: Pick<Task, "aiLocked" | "status" | "projectId"> & { column?: string | null }): Promise<boolean> {
  if (task.aiLocked) return true;
  const project = await db.project.findUnique({ where: { id: task.projectId }, select: { boardConfig: true } });
  return isAiLocked(task, project?.boardConfig);
}
