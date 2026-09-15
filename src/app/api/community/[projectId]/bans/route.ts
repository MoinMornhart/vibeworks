import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireCommunity, requireCommunityProject } from "@/lib/community";
import { canModerate } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { projectId: string };

const banSchema = z.object({ userId: z.string().min(1).max(40), reason: z.string().trim().max(200).nullish() });
const unbanSchema = z.object({ userId: z.string().min(1).max(40) });

// Sperren für die Community eines Projekts – Projektbesitzer oder Admin.
async function moderated(userId: string, projectId: string) {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const project = await requireCommunityProject(projectId);
  if (!canModerate(v, project.ownerId)) throw new ApiError(403, tk("community", "errors.notAllowed"));
  return { user, project };
}

async function list(projectId: string) {
  const bans = await db.communityBan.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  const users = await db.user.findMany({ where: { id: { in: bans.map((b) => b.userId) } }, select: { id: true, username: true, displayName: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return bans.flatMap((b) => {
    const u = byId.get(b.userId);
    return u ? [{ userId: u.id, name: displayNameOf(u), username: u.username, reason: b.reason, createdAt: b.createdAt.toISOString() }] : [];
  });
}

export const GET = route<Params>(async (_req, { params }) => {
  const { project } = await moderated("", (await params).projectId);
  return json({ bans: await list(project.id) });
});

export const POST = route<Params>(async (req, { params }) => {
  const { user, project } = await moderated("", (await params).projectId);
  limitOrThrow(`community-ban:${user.id}`, 30, 10 * MINUTE);
  const { userId, reason } = await readBody(req, banSchema, { maxBytes: 1024 });
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  // Besitzer, man selbst und Admins lassen sich hier nicht sperren
  if (!target || target.id === project.ownerId || target.id === user.id || target.role === "ADMIN") throw new ApiError(409, tk("community", "errors.cannotBan"));
  await db.communityBan.upsert({
    where: { projectId_userId: { projectId: project.id, userId } },
    create: { projectId: project.id, userId, reason: reason || null, createdById: user.id },
    update: { reason: reason || null },
  });
  return json({ bans: await list(project.id) });
});

export const DELETE = route<Params>(async (req, { params }) => {
  const { project } = await moderated("", (await params).projectId);
  const { userId } = await readBody(req, unbanSchema, { maxBytes: 512 });
  await db.communityBan.deleteMany({ where: { projectId: project.id, userId } });
  return json({ bans: await list(project.id) });
});
