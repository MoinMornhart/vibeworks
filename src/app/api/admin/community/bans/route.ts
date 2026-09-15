import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";

const banSchema = z.object({ userId: z.string().min(1).max(40), reason: z.string().trim().max(200).nullish() });
const unbanSchema = z.object({ userId: z.string().min(1).max(40) });

// Instanzweite Community-Sperre: lesen geht weiter, schreiben nicht. Admins lassen sich nicht sperren.
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const { userId, reason } = await readBody(req, banSchema, { maxBytes: 1024 });
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target || target.id === admin.id || target.role === "ADMIN") throw new ApiError(409, tk("community", "errors.cannotBan"));
  await db.user.update({ where: { id: userId }, data: { communityBannedAt: new Date(), communityBanReason: reason || null } });
  return json({ ok: true });
});

export const DELETE = route(async (req) => {
  await requireApiAdmin();
  const { userId } = await readBody(req, unbanSchema, { maxBytes: 512 });
  await db.user.updateMany({ where: { id: userId }, data: { communityBannedAt: null, communityBanReason: null } });
  return json({ ok: true });
});
