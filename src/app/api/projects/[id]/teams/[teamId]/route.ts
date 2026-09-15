import { z } from "zod";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string; teamId: string };

const roleSchema = z.object({ role: z.enum(["VIEWER", "EDITOR"]) });

// Rolle der Team-Freigabe ändern oder sie aufheben – nur der Besitzer.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, teamId } = await params;
  const { project } = await requireProject(user.id, id, "OWNER");
  const { role } = await readBody(req, roleSchema, { maxBytes: 256 });
  const { count } = await db.projectTeam.updateMany({ where: { projectId: project.id, teamId }, data: { role } });
  if (!count) throw notFound(tk("share", "errors.teamNotFound"));
  return json({ share: await shareState(project.id) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, teamId } = await params;
  const { project } = await requireProject(user.id, id, "OWNER");
  await db.projectTeam.deleteMany({ where: { projectId: project.id, teamId } });
  return json({ share: await shareState(project.id) });
});
