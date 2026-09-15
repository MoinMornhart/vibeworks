import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { actorOf, assertWithin, assignableProjectRole } from "@/lib/roles";
import { LEGACY_ROLE_ID } from "@/lib/rolesLogic";
import { accessDecisionSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

type Params = { id: string; requestId: string };

// Zugriffsanfrage annehmen (mit einer Rolle nach Wahl) oder ablehnen – Besitzer oder „Mitglieder einladen“.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, requestId } = await params;
  const res = await requireProject(user.id, id, "members.invite");
  const actor = actorOf(res, user.id);
  const { project } = res;
  const { decision, role, roleId } = await readBody(req, accessDecisionSchema);

  const request = await db.accessRequest.findFirst({
    where: { id: requestId, projectId: project.id, status: "PENDING" },
    include: { user: { select: { username: true } } },
  });
  if (!request) throw notFound(tk("share", "errors.requestNotFound"));

  const chosen = decision === "approve" ? await assignableProjectRole(roleId ?? LEGACY_ROLE_ID[role ?? request.role], project.ownerId) : null;
  if (chosen) assertWithin(chosen.permissions, actor);

  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({ where: { id: request.id }, data: { status: chosen ? "APPROVED" : "DENIED", decidedAt: new Date() } });
    if (chosen) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: request.userId } },
        create: { projectId: project.id, userId: request.userId, role: "VIEWER", roleId: chosen.id },
        update: { role: "VIEWER", roleId: chosen.id },
      });
    }
  });
  await logActivity({
    projectId: project.id,
    userId: user.id,
    kind: "PROJECT_UPDATED",
    summary: `Zugriffsanfrage von @${request.user.username} ${chosen ? `angenommen (${chosen.name})` : "abgelehnt"}`,
    meta: { action: chosen ? "requestApproved" : "requestDenied", username: request.user.username, ...(chosen ? { role: chosen.name } : {}) },
  });
  return json({ share: await shareState(project.id, actor) });
});
