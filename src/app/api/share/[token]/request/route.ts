import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { accessRequestSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { token: string };

// Angemeldete Besucher eines geteilten Links bitten um Zugriff. Eine erneute
// Anfrage (etwa nach Ablehnung) setzt die bestehende zurück auf „offen“.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`access-request:${user.id}`, 10, 10 * MINUTE);
  const { token } = await params;
  const project = await db.project.findUnique({
    where: { shareToken: token },
    select: { id: true, ownerId: true, members: { where: { userId: user.id }, select: { userId: true } } },
  });
  if (!project) throw notFound(tk("share", "errors.invalidLink"));
  if (project.ownerId === user.id || project.members.length) throw new ApiError(400, tk("share", "errors.alreadyAccess"));

  const { role, message } = await readBody(req, accessRequestSchema, { maxBytes: 4096 });
  await db.accessRequest.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role, message },
    update: { role, message, status: "PENDING", createdAt: new Date(), decidedAt: null },
  });
  return json({ status: "PENDING" }, { status: 201 });
});
