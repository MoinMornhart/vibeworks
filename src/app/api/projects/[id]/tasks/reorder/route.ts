import type { Task } from "@prisma/client";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { findOwnProject } from "@/lib/projects";
import { taskReorderSchema } from "@/lib/validation";
import { serializeTask, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { touchProject } from "@/lib/notes";

type Params = { id: string };

// Nach dem Ablegen schickt die Oberfläche die vollständige Liste der
// Zielspalte in neuer Reihenfolge; Position und Status vergibt der Server.
// Wiederholbar, ohne Positionsrechnerei im Browser. IDs, die nicht zum
// Projekt gehören, werden ignoriert statt verschoben.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await findOwnProject(user.id, id))) throw notFound("Projekt nicht gefunden");
  const { status, ids } = await readBody(req, taskReorderSchema);

  const tasks = await db.task.findMany({ where: { projectId: id, id: { in: ids } } });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = ids.filter((x) => byId.has(x));
  const spawned: Task[] = [];
  let statusChanged = false;

  await db.$transaction(async (tx) => {
    for (const [index, taskId] of ordered.entries()) {
      const task = byId.get(taskId)!;
      if (task.status !== status) {
        statusChanged = true;
        const res = await transitionTask(tx, task, status, user.id, { position: index });
        if (res.spawned) spawned.push(res.spawned);
      } else if (task.position !== index) {
        await tx.$executeRaw`UPDATE "Task" SET "position" = ${index} WHERE "id" = ${taskId} AND "projectId" = ${id}`;
      }
    }
  });

  if (statusChanged) await touchProject(id);
  const progress = await syncProjectProgress(id);
  return json({ ok: true, count: ordered.length, spawned: spawned.map(serializeTask), progress });
});
