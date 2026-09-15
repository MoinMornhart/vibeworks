import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { messageForChange, postForChange, replyForChange, requireCommunity } from "@/lib/community";
import { canModerate } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";

const bodySchema = z.object({ targetType: z.enum(["post", "reply", "message"]), targetId: z.string().min(1).max(40) });

async function ownerOf(targetType: "post" | "reply" | "message", targetId: string): Promise<string> {
  if (targetType === "post") return (await postForChange(targetId)).project.ownerId;
  if (targetType === "reply") return (await replyForChange(targetId)).project.ownerId;
  return (await messageForChange(targetId)).ownerId;
}

// Alle offenen Meldungen zu einem Ziel als erledigt markieren – Moderation des Raums oder Admin.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { targetType, targetId } = await readBody(req, bodySchema, { maxBytes: 512 });
  if (!canModerate(v, await ownerOf(targetType, targetId))) throw new ApiError(403, tk("community", "errors.notAllowed"));
  await db.communityReport.updateMany({ where: { targetType, targetId, status: "open" }, data: { status: "done", handledById: user.id, handledAt: new Date() } });
  return json({ ok: true });
});
