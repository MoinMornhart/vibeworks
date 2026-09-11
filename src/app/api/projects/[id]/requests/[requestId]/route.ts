import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { accessDecisionSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

type Params = { id: string; requestId: string };

// Zugriffsanfrage annehmen (optional mit anderer Rolle als erbeten) oder ablehnen.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, requestId } = await params;
  const { project } = await requireProject(user.id, id, "OWNER");
  const { decision, role } = await readBody(req, accessDecisionSchema);

  const request = await db.accessRequest.findFirst({
    where: { id: requestId, projectId: project.id, status: "PENDING" },
    include: { user: { select: { username: true } } },
  });
  if (!request) throw notFound(tk("share", "errors.requestNotFound"));

  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({ where: { id: request.id }, data: { status: decision === "approve" ? "APPROVED" : "DENIED", decidedAt: new Date() } });
    if (decision === "approve") {
      const granted = role ?? request.role;
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: request.userId } },
        create: { projectId: project.id, userId: request.userId, role: granted },
        update: { role: granted },
      });
    }
  });
  await logActivity({
    projectId: project.id,
    userId: user.id,
    kind: "PROJECT_UPDATED",
    summary: `Zugriffsanfrage von @${request.user.username} ${decision === "approve" ? "angenommen" : "abgelehnt"}`,
  });
  return json({ share: await shareState(project.id) });
});
