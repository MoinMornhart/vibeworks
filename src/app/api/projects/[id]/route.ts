import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject, visibleTo } from "@/lib/access";
import { projectUpdateSchema } from "@/lib/validation";
import { nextPosition, projectListSelect, serializeProject, uniqueSlug } from "@/lib/projects";
import { syncProjectProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { parseRepoUrl } from "@/lib/git/parse";

type Params = { id: string };

async function loadDetail(ownerId: string, id: string) {
  const project = await db.project.findFirst({ where: { id, ...visibleTo(ownerId) }, select: { ...projectListSelect, description: true } });
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
  const { project: current, access } = await requireProject(user.id, id, "EDITOR");
  const input = await readBody(req, projectUpdateSchema);
  // Repository (samt Token) und Favorit gehören dem Besitzer.
  const ownerOnly =
    (input.repoUrl !== undefined && input.repoUrl !== current.repoUrl) || (input.favorite !== undefined && input.favorite !== current.favorite);
  if (ownerOnly && access !== "OWNER") throw new ApiError(403, "Repository und Favorit ändert nur der Besitzer des Projekts.");

  const data: Record<string, unknown> = { ...input };
  // Slug und Spaltenposition beziehen sich auf das Board des Besitzers.
  if (input.name && input.name !== current.name) data.slug = await uniqueSlug(current.ownerId, input.name, id);
  const statusChanged = input.status !== undefined && input.status !== current.status;
  if (statusChanged) data.position = await nextPosition(current.ownerId, input.status!);

  const updated = await db.project.update({ where: { id }, data, select: { status: true, progressFromTasks: true } });
  // Anderes Repository: zwischengespeicherte Commits und Issue-Nummern gehören zum alten.
  if (input.repoUrl !== undefined && input.repoUrl !== current.repoUrl) {
    await db.repoCache.deleteMany({ where: { projectId: id } });
    await db.$executeRaw`UPDATE "Task" SET "issueNumber" = NULL, "issueUrl" = NULL, "issueError" = NULL WHERE "projectId" = ${id}`;
    // Ein Token gilt nur für seinen Server – nie an einen anderen Host schicken.
    if (parseRepoUrl(input.repoUrl)?.host !== parseRepoUrl(current.repoUrl)?.host) {
      await db.project.update({ where: { id }, data: { repoTokenCipher: null, repoTokenHint: null } });
    }
  }
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
