import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { canDo, requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { actorOf, assertWithin, assignableProjectRole, canManageGrant } from "@/lib/roles";
import { LEGACY_ROLE_ID, permissionsOf } from "@/lib/rolesLogic";
import { memberUpdateSchema } from "@/lib/validation";

type Params = { id: string; userId: string };

const grant = { role: true, roleRef: { select: { permissions: true } } } as const;

// Rolle eines Mitglieds ändern – Besitzer oder „Mitglieder einladen“ (nur wer nicht mehr darf, nur Rollen bis zu den eigenen Rechten).
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, userId } = await params;
  const res = await requireProject(user.id, id, "members.invite");
  const actor = actorOf(res, user.id);
  const { roleId, role } = await readBody(req, memberUpdateSchema);
  const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId: res.project.id, userId } }, select: grant });
  if (!member) throw notFound(tk("share", "errors.memberNotFound"));
  if (!canManageGrant(actor, userId, permissionsOf([member]))) throw new ApiError(403, tk("roles", "errors.aboveYou"));
  const chosen = await assignableProjectRole(roleId ?? LEGACY_ROLE_ID[role ?? "VIEWER"], res.project.ownerId);
  assertWithin(chosen.permissions, actor);
  await db.projectMember.update({ where: { projectId_userId: { projectId: res.project.id, userId } }, data: { role: "VIEWER", roleId: chosen.id } });
  return json({ share: await shareState(res.project.id, actor) });
});

// Entfernen (Besitzer oder „Mitglieder einladen“ mit denselben Grenzen) – oder selbst gehen.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, userId: rawUserId } = await params;
  const userId = rawUserId === "me" ? user.id : rawUserId;
  const res = await requireProject(user.id, id);
  const actor = actorOf(res, user.id);
  const leaving = userId === user.id && !actor.owner;
  if (!leaving) {
    if (!canDo(res, "members.invite")) throw new ApiError(403, tk("share", "errors.membersOwnerOnly"));
    const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId: res.project.id, userId } }, select: grant });
    if (member && !canManageGrant(actor, userId, permissionsOf([member]))) throw new ApiError(403, tk("roles", "errors.aboveYou"));
  }
  const { count } = await db.projectMember.deleteMany({ where: { projectId: res.project.id, userId } });
  // Zugriff nur über ein Team: dort austreten statt hier
  if (!count && leaving) throw new ApiError(409, tk("share", "errors.viaTeamOnly"));
  if (!count) throw notFound(tk("share", "errors.memberNotFound"));
  return json(leaving ? { ok: true } : { share: await shareState(res.project.id, actor) });
});
