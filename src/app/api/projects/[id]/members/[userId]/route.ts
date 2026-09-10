import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { memberUpdateSchema } from "@/lib/validation";

type Params = { id: string; userId: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, userId } = await params;
  const { project } = await requireProject(user.id, id, "OWNER");
  const { role } = await readBody(req, memberUpdateSchema);
  const { count } = await db.projectMember.updateMany({ where: { projectId: project.id, userId }, data: { role } });
  if (!count) throw notFound("Mitglied nicht gefunden");
  return json({ share: await shareState(project.id) });
});

// Der Besitzer entfernt ein Mitglied – oder ein Mitglied verlässt das Projekt selbst.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, userId: rawUserId } = await params;
  const userId = rawUserId === "me" ? user.id : rawUserId;
  const { project, access } = await requireProject(user.id, id);
  const leaving = userId === user.id && access !== "OWNER";
  if (access !== "OWNER" && !leaving) throw new ApiError(403, "Mitglieder verwaltet nur der Besitzer des Projekts.");
  const { count } = await db.projectMember.deleteMany({ where: { projectId: project.id, userId } });
  if (!count) throw notFound("Mitglied nicht gefunden");
  return json(leaving ? { ok: true } : { share: await shareState(project.id) });
});
