import { z } from "zod";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { actorOf, assignableProjectRole } from "@/lib/roles";
import { LEGACY_ROLE_ID } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string; teamId: string };

const roleSchema = z.object({ roleId: z.string().min(1).max(40).optional(), role: z.enum(["VIEWER", "EDITOR"]).optional() });

// Rolle der Team-Freigabe ändern oder sie aufheben – nur der Besitzer.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, teamId } = await params;
  const res = await requireProject(user.id, id, "OWNER");
  const { roleId, role } = await readBody(req, roleSchema, { maxBytes: 256 });
  const chosen = await assignableProjectRole(roleId ?? LEGACY_ROLE_ID[role ?? "VIEWER"], res.project.ownerId);
  const { count } = await db.projectTeam.updateMany({ where: { projectId: res.project.id, teamId }, data: { role: "VIEWER", roleId: chosen.id } });
  if (!count) throw notFound(tk("share", "errors.teamNotFound"));
  return json({ share: await shareState(res.project.id, actorOf(res, user.id)) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, teamId } = await params;
  const res = await requireProject(user.id, id, "OWNER");
  await db.projectTeam.deleteMany({ where: { projectId: res.project.id, teamId } });
  return json({ share: await shareState(res.project.id, actorOf(res, user.id)) });
});
