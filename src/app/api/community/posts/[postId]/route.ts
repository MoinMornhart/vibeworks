import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { authorSelect, bannedHere, postForChange, requireCommunity, serializePost } from "@/lib/community";
import { canDelete, canModerate, canSee, canWrite, MAX_BODY, MAX_TITLE, POST_STATUSES } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { postId: string };

const patchSchema = z.object({
  title: z.string().trim().min(3, tk("community", "errors.titleShort")).max(MAX_TITLE, tk("community", "errors.titleLong")).optional(),
  body: z.string().trim().min(1, tk("community", "errors.bodyEmpty")).max(MAX_BODY, tk("community", "errors.bodyLong")).optional(),
  status: z.enum(POST_STATUSES).optional(),
  hidden: z.boolean().optional(),
});

const forbidden = () => new ApiError(403, tk("community", "errors.notAllowed"));

// Text ändern: nur der Autor. Status: Autor und Moderation. Ausblenden: nur die Moderation.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { post, project } = await postForChange((await params).postId);
  if (!canSee(v, post, project.ownerId)) throw forbidden();
  limitOrThrow(`community-edit:${user.id}`, 60, 10 * MINUTE);
  const input = await readBody(req, patchSchema, { maxBytes: MAX_BODY * 4 });
  const mod = canModerate(v, project.ownerId);
  const author = post.authorId === user.id;
  if ((input.title !== undefined || input.body !== undefined) && !author) throw forbidden();
  if (input.hidden !== undefined && !mod) throw forbidden();
  if (input.status !== undefined && !mod && !author) throw forbidden();
  if (!mod && !canWrite(v, await bannedHere(project.id, user.id))) throw new ApiError(403, tk("community", "errors.banned"));
  const updated = await db.communityPost.update({ where: { id: post.id }, data: input, include: { author: authorSelect } });
  return json({ post: serializePost(updated, v, project.ownerId) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { post, project } = await postForChange((await params).postId);
  if (!canDelete(v, post.authorId, project.ownerId)) throw forbidden();
  const replyIds = (await db.communityReply.findMany({ where: { postId: post.id }, select: { id: true } })).map((r) => r.id);
  await db.$transaction([
    db.communityReport.deleteMany({ where: { OR: [{ targetType: "post", targetId: post.id }, { targetType: "reply", targetId: { in: replyIds } }] } }),
    db.communityPost.delete({ where: { id: post.id } }),
  ]);
  return json({ ok: true });
});
