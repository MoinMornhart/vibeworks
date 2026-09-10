import type { Prisma, PrismaClient, Task, TaskStatus } from "@prisma/client";
import { db } from "./db";
import { logActivity } from "./activity";
import { dayKeyToDate, derivedProgress, nextDueKey } from "./taskDates";
import { TASK_STATUSES } from "./status";
import { dayKey, truncate } from "./utils";

type Client = PrismaClient | Prisma.TransactionClient;

export function serializeTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    position: t.position,
    dueDate: t.dueDate ? dayKey(t.dueDate) : null,
    labels: t.labels,
    recurrence: t.recurrence,
    doneAt: t.doneAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}
export type TaskItem = ReturnType<typeof serializeTask>;

export const TASK_ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];

const statusLabel = (s: TaskStatus) => TASK_STATUSES.find((x) => x.value === s)?.label ?? s;

export async function findOwnTask(ownerId: string, id: string) {
  return db.task.findFirst({ where: { id, project: { ownerId } } });
}

export async function nextTaskPosition(client: Client, projectId: string, status: TaskStatus): Promise<number> {
  const last = await client.task.findFirst({ where: { projectId, status }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? -1) + 1;
}

/**
 * Statuswechsel mit allen Folgen: Zeitpunkt des Erledigens setzen bzw.
 * löschen, bei wiederkehrenden Aufgaben die nächste Fassung anlegen und den
 * Vorgang im Verlauf festhalten. Nur der Übergang nach „Erledigt“ löst die
 * Wiederholung aus – erneutes Speichern einer erledigten Aufgabe nicht.
 */
export async function transitionTask(
  client: Client,
  task: Task,
  to: TaskStatus,
  userId: string | null,
  data: Prisma.TaskUncheckedUpdateInput = {},
): Promise<{ task: Task; spawned: Task | null }> {
  const from = task.status;
  const update: Prisma.TaskUncheckedUpdateInput = { ...data, status: to };
  if (to === "DONE" && from !== "DONE") update.doneAt = new Date();
  if (from === "DONE" && to !== "DONE") update.doneAt = null;
  const updated = await client.task.update({ where: { id: task.id }, data: update });

  let spawned: Task | null = null;
  if (to === "DONE" && from !== "DONE" && updated.recurrence) {
    const due = nextDueKey(updated.dueDate ? dayKey(updated.dueDate) : null, updated.recurrence, dayKey(new Date()));
    spawned = await client.task.create({
      data: {
        projectId: updated.projectId,
        title: updated.title,
        description: updated.description,
        labels: updated.labels,
        recurrence: updated.recurrence,
        recurredFrom: updated.id,
        dueDate: dayKeyToDate(due),
        status: "TODO",
        position: await nextTaskPosition(client, updated.projectId, "TODO"),
      },
    });
  }

  if (from !== to) {
    await logActivity(
      {
        projectId: updated.projectId,
        userId,
        kind: "TASK_MOVED",
        summary: `Aufgabe „${truncate(updated.title, 60)}“: ${statusLabel(from)} → ${statusLabel(to)}`,
        meta: { from, to, taskId: updated.id },
      },
      client,
    );
  }
  return { task: updated, spawned };
}

/** Fortschritt aus dem Anteil erledigter Aufgaben – nur wenn am Projekt eingeschaltet. */
export async function syncProjectProgress(projectId: string, client: Client = db): Promise<number | null> {
  const project = await client.project.findUnique({ where: { id: projectId }, select: { progressFromTasks: true } });
  if (!project?.progressFromTasks) return null;
  const [total, done] = await Promise.all([
    client.task.count({ where: { projectId } }),
    client.task.count({ where: { projectId, status: "DONE" } }),
  ]);
  const progress = derivedProgress(total, done);
  await client.$executeRaw`UPDATE "Project" SET "progress" = ${progress} WHERE "id" = ${projectId}`;
  return progress;
}
