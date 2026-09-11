import { after } from "next/server";
import { db } from "@/lib/db";
import { pushTaskIssue } from "@/lib/git/issues";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { taskCreateSchema } from "@/lib/validation";
import { nextTaskPosition, serializeTask, syncProjectProgress, TASK_ORDER } from "@/lib/tasks";
import { dayKeyToDate } from "@/lib/taskDates";
import { touchProject } from "@/lib/notes";
import { logActivity } from "@/lib/activity";
import { truncate } from "@/lib/utils";

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

  const task = await db.task.create({
    data: {
      ...input,
      dueDate: input.dueDate ? dayKeyToDate(input.dueDate) : null,
      doneAt: input.status === "DONE" ? new Date() : null,
      projectId: id,
      position: await nextTaskPosition(db, id, input.status),
    },
  });
  await logActivity({ projectId: id, userId: user.id, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(task.title, 60)}“ angelegt`, meta: { title: truncate(task.title, 60), taskId: task.id } });
  await touchProject(id);
  const progress = await syncProjectProgress(id);
  after(() => pushTaskIssue(task.id));
  return json({ task: serializeTask(task), progress }, { status: 201 });
});
