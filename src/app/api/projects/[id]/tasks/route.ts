import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { taskCreateSchema } from "@/lib/validation";
import { serializeTask, TASK_ORDER } from "@/lib/tasks";
import { createTask } from "@/lib/actions";

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
  await requireProject(user.id, id, "EDITOR");
  const input = await readBody(req, taskCreateSchema);
  const { task, progress } = await createTask(user.id, id, input);
  return json({ task: serializeTask(task), progress }, { status: 201 });
});
