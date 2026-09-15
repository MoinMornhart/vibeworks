import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { authorSelect, bannedHere, notifyCommunity, requireCommunity, requireCommunityProject, serializePost } from "@/lib/community";
import { canWrite, MAX_BODY, MAX_TITLE, POST_KINDS } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { projectId: string };

const bodySchema = z.object({
  kind: z.enum(POST_KINDS),
  title: z.string().trim().min(3, tk("community", "errors.titleShort")).max(MAX_TITLE, tk("community", "errors.titleLong")),
  body: z.string().trim().min(1, tk("community", "errors.bodyEmpty")).max(MAX_BODY, tk("community", "errors.bodyLong")),
});

// Neuer Beitrag (Frage, Idee, Fehler) zu einem vorgestellten Projekt.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const project = await requireCommunityProject((await params).projectId);
  if (!canWrite(v, await bannedHere(project.id, user.id))) throw new ApiError(403, tk("community", "errors.banned"));
  limitOrThrow(`community-post:${user.id}`, 10, 10 * MINUTE);
  const input = await readBody(req, bodySchema, { maxBytes: MAX_BODY * 4 });
  const post = await db.communityPost.create({ data: { projectId: project.id, authorId: user.id, ...input }, include: { author: authorSelect } });
  if (project.ownerId !== user.id) {
    void notifyCommunity(project.ownerId, "post", { project: project.name, title: post.title, author: displayNameOf(user) }, `/community/${project.id}/${post.id}`);
  }
  return json({ post: serializePost(post, v, project.ownerId) }, { status: 201 });
});
