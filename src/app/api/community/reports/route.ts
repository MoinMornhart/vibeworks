import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { messageForChange, postForChange, replyForChange, requireCommunity } from "@/lib/community";
import { canSee, LOBBY, REPORT_REASONS, type Viewer } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const TARGET_TYPES = ["post", "reply", "message"] as const;

const bodySchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(40),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(300).nullish(),
});

/** Ziel einer Meldung: Autor, Raum und ob der Meldende es überhaupt sehen darf. */
async function target(type: (typeof TARGET_TYPES)[number], id: string) {
  if (type === "post") {
    const { post, project } = await postForChange(id);
    return { authorId: post.authorId, projectId: project.id, visible: (v: Viewer) => canSee(v, post, project.ownerId) };
  }
  if (type === "reply") {
    const { reply, post, project } = await replyForChange(id);
    return { authorId: reply.authorId, projectId: project.id, visible: (v: Viewer) => canSee(v, post, project.ownerId) && canSee(v, reply, project.ownerId) };
  }
  const { message, projectId, ownerId } = await messageForChange(id);
  return { authorId: message.authorId, projectId: projectId ?? LOBBY, visible: (v: Viewer) => canSee(v, message, ownerId) };
}

// Beitrag, Antwort oder Chat-Nachricht melden – je Konto und Ziel einmal.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  limitOrThrow(`community-report:${user.id}`, 20, 60 * MINUTE);
  const input = await readBody(req, bodySchema, { maxBytes: 2048 });
  const t = await target(input.targetType, input.targetId);
  if (!t.visible(v)) throw notFound(tk("community", "errors.postNotFound"));
  if (t.authorId === user.id) throw new ApiError(400, tk("community", "errors.ownReport"));
  try {
    await db.communityReport.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        projectId: t.projectId,
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
