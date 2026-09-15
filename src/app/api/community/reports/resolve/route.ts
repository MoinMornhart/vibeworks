import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { postForChange, replyForChange, requireCommunity } from "@/lib/community";
import { canModerate } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";

const bodySchema = z.object({ targetType: z.enum(["post", "reply"]), targetId: z.string().min(1).max(40) });

// Alle offenen Meldungen zu einem Ziel als erledigt markieren – Projektbesitzer oder Admin.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { targetType, targetId } = await readBody(req, bodySchema, { maxBytes: 512 });
  const { project } = targetType === "post" ? await postForChange(targetId) : await replyForChange(targetId);
  if (!canModerate(v, project.ownerId)) throw new ApiError(403, tk("community", "errors.notAllowed"));
  await db.communityReport.updateMany({ where: { targetType, targetId, status: "open" }, data: { status: "done", handledById: user.id, handledAt: new Date() } });
  return json({ ok: true });
});
