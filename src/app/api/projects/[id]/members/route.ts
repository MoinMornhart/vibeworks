import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { memberAddSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Konto direkt über den Benutzernamen hinzufügen.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`member-add:${user.id}`, 30, 10 * MINUTE);
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const { username, role } = await readBody(req, memberAddSchema);

  const target = await db.user.findFirst({ where: { username, active: true }, select: { id: true } });
  if (!target) throw new ApiError(404, "Kein aktives Konto mit diesem Benutzernamen.", { username: "Unbekannt" });
  if (target.id === project.ownerId) throw new ApiError(400, "Das Projekt gehört dir schon.", { username: "Das bist du" });

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: target.id } },
    create: { projectId: project.id, userId: target.id, role },
    update: { role },
  });
  // Eine offene Anfrage dieses Kontos ist damit erledigt.
  await db.accessRequest.updateMany({
    where: { projectId: project.id, userId: target.id, status: "PENDING" },
    data: { status: "APPROVED", decidedAt: new Date() },
  });
  return json({ share: await shareState(project.id) }, { status: 201 });
});
