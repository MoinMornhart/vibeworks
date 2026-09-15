import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { authorSelect, bannedHere, notifyCommunity, postForChange, requireCommunity, serializePost, serializeReply } from "@/lib/community";
import { canModerate, canSee, canWrite, MAX_REPLY } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { postId: string };

const bodySchema = z.object({ body: z.string().trim().min(1, tk("community", "errors.bodyEmpty")).max(MAX_REPLY, tk("community", "errors.bodyLong")) });

// Antwort schreiben. Antwortet der Projektbesitzer auf eine offene Frage, gilt sie als beantwortet.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { post, project } = await postForChange((await params).postId);
  if (!canSee(v, post, project.ownerId)) throw notFound(tk("community", "errors.postNotFound"));
  const mod = canModerate(v, project.ownerId);
  if (post.status === "closed" && !mod) throw new ApiError(409, tk("community", "errors.closed"));
  if (!canWrite(v, await bannedHere(project.id, user.id))) throw new ApiError(403, tk("community", "errors.banned"));
  limitOrThrow(`community-reply:${user.id}`, 30, 10 * MINUTE);
  const { body } = await readBody(req, bodySchema, { maxBytes: MAX_REPLY * 4 });

  const answered = user.id === project.ownerId && post.kind === "question" && post.status === "open";
  const [reply, updated] = await db.$transaction([
    db.communityReply.create({ data: { postId: post.id, authorId: user.id, body }, include: { author: authorSelect } }),
    db.communityPost.update({
      where: { id: post.id },
      data: { replyCount: { increment: 1 }, lastActivityAt: new Date(), ...(answered ? { status: "answered" } : {}) },
      include: { author: authorSelect },
    }),
  ]);

  const vars = { project: project.name, title: post.title, author: displayNameOf(user) };
  for (const to of new Set([post.authorId, project.ownerId])) {
    if (to !== user.id) void notifyCommunity(to, "reply", vars, `/community/${project.id}/${post.id}#r-${reply.id}`);
  }
  return json({ reply: serializeReply(reply, v, project.ownerId), post: serializePost(updated, v, project.ownerId) }, { status: 201 });
});
