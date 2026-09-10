import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { projectUpdateSchema } from "@/lib/validation";
import { findOwnProject, nextPosition, projectListSelect, serializeProject, uniqueSlug } from "@/lib/projects";
import { syncProjectProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { PROJECT_STATUS_MAP } from "@/lib/status";

type Params = { id: string };

async function loadDetail(ownerId: string, id: string) {
  const project = await db.project.findFirst({ where: { id, ownerId }, select: { ...projectListSelect, description: true } });
  if (!project) return null;
  const done = await db.task.count({ where: { projectId: id, status: "DONE" } });
  return serializeProject(project, done);
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const project = await loadDetail(user.id, (await params).id);
  if (!project) throw notFound("Projekt nicht gefunden");
  return json({ project });
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const current = await findOwnProject(user.id, id);
  if (!current) throw notFound("Projekt nicht gefunden");
  const input = await readBody(req, projectUpdateSchema);

  const data: Record<string, unknown> = { ...input };
  if (input.name && input.name !== current.name) data.slug = await uniqueSlug(user.id, input.name, id);
  const statusChanged = input.status !== undefined && input.status !== current.status;
  if (statusChanged) data.position = await nextPosition(user.id, input.status!);

  const updated = await db.project.update({ where: { id }, data, select: { status: true, progressFromTasks: true } });
  // Mit abgeleitetem Fortschritt gilt der Anteil erledigter Aufgaben, nicht der Regler.
  if (updated.progressFromTasks) await syncProjectProgress(id);

  if (statusChanged) {
    await logActivity({
      projectId: id,
      userId: user.id,
      kind: "STATUS_CHANGED",
      summary: `Status: ${PROJECT_STATUS_MAP[current.status].label} → ${PROJECT_STATUS_MAP[updated.status].label}`,
      meta: { from: current.status, to: updated.status },
    });
  }
  const otherFields = Object.keys(input).filter((k) => !["status", "favorite", "progress"].includes(k));
  if (otherFields.length) {
    await logActivity({ projectId: id, userId: user.id, kind: "PROJECT_UPDATED", summary: "Projektangaben bearbeitet", meta: { fields: otherFields } });
  }
  return json({ project: await loadDetail(user.id, id) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { count } = await db.project.deleteMany({ where: { id, ownerId: user.id } });
  if (!count) throw notFound("Projekt nicht gefunden");
  return json({ ok: true });
});
