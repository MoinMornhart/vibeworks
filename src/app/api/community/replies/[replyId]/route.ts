import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { authorSelect, bannedHere, replyForChange, requireCommunity, serializeReply } from "@/lib/community";
import { canDelete, canModerate, canSee, canWrite, MAX_REPLY } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { replyId: string };

const patchSchema = z.object({
  body: z.string().trim().min(1, tk("community", "errors.bodyEmpty")).max(MAX_REPLY, tk("community", "errors.bodyLong")).optional(),
  hidden: z.boolean().optional(),
});

const forbidden = () => new ApiError(403, tk("community", "errors.notAllowed"));

// Text ändern: nur der Autor. Ausblenden: nur die Moderation.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { reply, post, project } = await replyForChange((await params).replyId);
  if (!canSee(v, post, project.ownerId) || !canSee(v, reply, project.ownerId)) throw forbidden();
  limitOrThrow(`community-edit:${user.id}`, 60, 10 * MINUTE);
  const input = await readBody(req, patchSchema, { maxBytes: MAX_REPLY * 4 });
  const mod = canModerate(v, project.ownerId);
  if (input.body !== undefined && reply.authorId !== user.id) throw forbidden();
  if (input.hidden !== undefined && !mod) throw forbidden();
  if (!mod && !canWrite(v, await bannedHere(project.id, user.id))) throw new ApiError(403, tk("community", "errors.banned"));
  const updated = await db.communityReply.update({ where: { id: reply.id }, data: input, include: { author: authorSelect } });
  return json({ reply: serializeReply(updated, v, project.ownerId) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { reply, post, project } = await replyForChange((await params).replyId);
  if (!canDelete(v, reply.authorId, project.ownerId)) throw forbidden();
  await db.$transaction([
    db.communityReport.deleteMany({ where: { targetType: "reply", targetId: reply.id } }),
    db.communityReply.delete({ where: { id: reply.id } }),
    db.communityPost.update({ where: { id: post.id }, data: { replyCount: Math.max(0, post.replyCount - 1) } }),
  ]);
  return json({ ok: true });
});
