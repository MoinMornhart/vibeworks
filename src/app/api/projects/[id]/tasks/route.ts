import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { taskCreateSchema } from "@/lib/validation";
import { serializeTask, syncProjectProgress, TASK_ORDER } from "@/lib/tasks";
import { createTask } from "@/lib/actions";
import { logActivity } from "@/lib/activity";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id);
  const tasks = await db.task.findMany({ where: { projectId: id }, orderBy: TASK_ORDER });
  return json({ tasks: tasks.map(serializeTask) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id, "tasks.edit");
  const input = await readBody(req, taskCreateSchema);
  const { task, progress } = await createTask(user.id, id, input);
  return json({ task: serializeTask(task), progress }, { status: 201 });
});

// Erledigte auf einmal löschen (#100). Nur Status DONE – ihre Issues sind schon
// geschlossen und bleiben es (der Import holt nur offene).
export const DELETE = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id, "tasks.delete");
  if (new URL(req.url).searchParams.get("status") !== "DONE") return json({ error: "status=DONE" }, { status: 400 });
  const done = await db.task.findMany({ where: { projectId: id, status: "DONE" }, select: { id: true } });
  if (!done.length) return json({ deleted: 0, ids: [], progress: await syncProjectProgress(id) });
  const ids = done.map((t) => t.id);
  const { count } = await db.task.deleteMany({ where: { id: { in: ids }, status: "DONE" } });
  await logActivity({ projectId: id, userId: user.id, kind: "TASK_DELETED", summary: `${count} erledigte Aufgaben gelöscht`, meta: { cleared: count } });
  const progress = await syncProjectProgress(id);
  return json({ deleted: count, ids, progress });
});
