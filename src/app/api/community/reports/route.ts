import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { postForChange, replyForChange, requireCommunity } from "@/lib/community";
import { canSee, REPORT_REASONS } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const bodySchema = z.object({
  targetType: z.enum(["post", "reply"]),
  targetId: z.string().min(1).max(40),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(300).nullish(),
});

// Beitrag oder Antwort melden – je Konto und Ziel einmal.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  limitOrThrow(`community-report:${user.id}`, 20, 60 * MINUTE);
  const input = await readBody(req, bodySchema, { maxBytes: 2048 });
  const target =
    input.targetType === "post"
      ? await postForChange(input.targetId).then(({ post, project }) => ({ item: post, post, project }))
      : await replyForChange(input.targetId).then(({ reply, post, project }) => ({ item: reply, post, project }));
  if (!canSee(v, target.post, target.project.ownerId) || !canSee(v, target.item, target.project.ownerId)) throw notFound(tk("community", "errors.postNotFound"));
  if (target.item.authorId === user.id) throw new ApiError(400, tk("community", "errors.ownReport"));
  try {
    await db.communityReport.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        projectId: target.project.id,
        reporterId: user.id,
        reason: input.note ? `${input.reason}: ${input.note}` : input.reason,
      },
    });
  } catch (err) {
    // Schon gemeldet – kein Fehler
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  return json({ ok: true }, { status: 201 });
});
