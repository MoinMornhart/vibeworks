import { after } from "next/server";
import { db } from "@/lib/db";
import { closeIssueOfDeletedTask } from "@/lib/git/issues";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { taskUpdateSchema } from "@/lib/validation";
import { serializeTask, syncProjectProgress } from "@/lib/tasks";
import { updateTask } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { truncate } from "@/lib/utils";

type Params = { id: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { task: current } = await requireTask(user.id, id, "EDITOR");
  const input = await readBody(req, taskUpdateSchema);
  const result = await updateTask(user.id, current, input);
  return json({ task: serializeTask(result.task), spawned: result.spawned ? serializeTask(result.spawned) : null, progress: result.progress });
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
