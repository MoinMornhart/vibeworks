import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { actorOf, assertWithin, assignableProjectRole, canManageGrant } from "@/lib/roles";
import { LEGACY_ROLE_ID, permissionsOf } from "@/lib/rolesLogic";
import { memberAddSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Konto direkt über den Benutzernamen hinzufügen – der Besitzer oder wer „Mitglieder
// einladen“ darf; dann nur mit Rollen, die höchstens die eigenen Rechte haben.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`member-add:${user.id}`, 30, 10 * MINUTE);
  const res = await requireProject(user.id, (await params).id, "members.invite");
  const actor = actorOf(res, user.id);
  const { project } = res;
  const { username, roleId, role } = await readBody(req, memberAddSchema);

  const target = await db.user.findFirst({ where: { username, active: true }, select: { id: true } });
  if (!target) throw new ApiError(404, tk("share", "errors.noAccount"), { username: tk("share", "errors.unknown") });
  if (target.id === project.ownerId) throw new ApiError(400, tk("share", "errors.alreadyOwner"), { username: tk("share", "errors.thatsYou") });

  const chosen = await assignableProjectRole(roleId ?? LEGACY_ROLE_ID[role], project.ownerId);
  assertWithin(chosen.permissions, actor);
  // Wer schon mehr darf als der Handelnde, wird von ihm nicht umgestuft
  const existing = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: target.id } },
    select: { role: true, roleRef: { select: { permissions: true } } },
  });
  if (existing && !canManageGrant(actor, target.id, permissionsOf([existing]))) throw new ApiError(403, tk("roles", "errors.aboveYou"));

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: target.id } },
    create: { projectId: project.id, userId: target.id, role: "VIEWER", roleId: chosen.id },
    update: { role: "VIEWER", roleId: chosen.id },
  });
  // Eine offene Anfrage dieses Kontos ist damit erledigt.
  await db.accessRequest.updateMany({
    where: { projectId: project.id, userId: target.id, status: "PENDING" },
    data: { status: "APPROVED", decidedAt: new Date() },
  });
  await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary: `@${username} als „${chosen.name}“ hinzugefügt`, meta: { action: "memberAdded", username, role: chosen.name } });
  return json({ share: await shareState(project.id, actor) }, { status: 201 });
});
