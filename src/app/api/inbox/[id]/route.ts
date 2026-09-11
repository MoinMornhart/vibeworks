import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { inboxActionSchema } from "@/lib/validation";
import { inboxToProject, inboxToTask } from "@/lib/inboxServer";

type Params = { id: string };

async function own(userId: string, id: string) {
  const item = await db.inboxItem.findFirst({ where: { id, userId } });
  if (!item) throw notFound(tk("inbox", "errors.notFound"));
  return item;
}

// Aus dem Eingang: neues Projekt („Idee“) oder Aufgabe in einem Projekt.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const item = await own(user.id, (await params).id);
  const input = await readBody(req, inboxActionSchema, { maxBytes: 1024 });
  if (input.action === "project") {
    const project = await inboxToProject(user.id, item);
    return json({ project });
  }
  const { project } = await requireProject(user.id, input.projectId, "EDITOR");
  const task = await inboxToTask(user.id, item, project.id);
  return json({ task: { id: task.id, title: task.title }, project: { id: project.id, name: project.name } });
});

// Verwerfen
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const item = await own(user.id, (await params).id);
  await db.inboxItem.delete({ where: { id: item.id } });
  return json({ ok: true });
});
