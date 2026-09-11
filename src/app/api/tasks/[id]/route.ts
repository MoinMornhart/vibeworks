import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/lib/db";
import { closeIssueOfDeletedTask, pushTaskIssues } from "@/lib/git/issues";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { taskUpdateSchema } from "@/lib/validation";
import { nextTaskPosition, serializeTask, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { dayKeyToDate } from "@/lib/taskDates";
import { touchProject } from "@/lib/notes";
import { logActivity } from "@/lib/activity";
import { truncate } from "@/lib/utils";

type Params = { id: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { task: current } = await requireTask(user.id, id, "EDITOR");
  const input = await readBody(req, taskUpdateSchema);

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.labels !== undefined) data.labels = input.labels;
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? dayKeyToDate(input.dueDate) : null;

  let result;
  if (input.status !== undefined && input.status !== current.status) {
    // Beim Spaltenwechsel ans Ende der neuen Spalte
    data.position = await nextTaskPosition(db, current.projectId, input.status);
    result = await db.$transaction((tx) => transitionTask(tx, current, input.status!, user.id, data));
  } else {
    result = { task: await db.task.update({ where: { id }, data }), spawned: null };
  }

  await touchProject(current.projectId);
  const progress = await syncProjectProgress(current.projectId);
  const pushIds = [result.task.id, ...(result.spawned ? [result.spawned.id] : [])];
  after(() => pushTaskIssues(pushIds));
  return json({ task: serializeTask(result.task), spawned: result.spawned ? serializeTask(result.spawned) : null, progress });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { task } = await requireTask(user.id, id, "EDITOR");
  await db.task.delete({ where: { id } });
  await logActivity({ projectId: task.projectId, userId: user.id, kind: "TASK_DELETED", summary: `Aufgabe „${truncate(task.title, 60)}“ gelöscht`, meta: { title: truncate(task.title, 60) } });
  const progress = await syncProjectProgress(task.projectId);
  after(() => closeIssueOfDeletedTask(task.projectId, task));
  return json({ ok: true, progress });
});
