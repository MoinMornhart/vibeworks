import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser, type SessionUser } from "@/lib/auth/guard";
import { bannedHere, chatRoom, loadMessages, requireCommunity } from "@/lib/community";
import { canModerate, canWrite, MAX_MESSAGE } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { room: string };

const bodySchema = z.object({ body: z.string().trim().min(1, tk("community", "errors.bodyEmpty")).max(MAX_MESSAGE, tk("community", "errors.bodyLong")) });

// Chat: "lobby" für alle Konten der Instanz oder der Chat eines Community-Projekts.
// Die Seite fragt alle paar Sekunden nach – geliefert werden die letzten 100 Nachrichten.
async function roomState(room: string, user: SessionUser) {
  const v = await requireCommunity(user);
  const { projectId, ownerId } = await chatRoom(room);
  const banned = projectId ? await bannedHere(projectId, user.id) : false;
  return { v, projectId, ownerId, writable: canWrite(v, banned) };
}

async function reply(s: Awaited<ReturnType<typeof roomState>>, status = 200) {
  return json({ messages: await loadMessages(s.projectId, s.v, s.ownerId), canWrite: s.writable, moderator: canModerate(s.v, s.ownerId) }, { status });
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  return reply(await roomState((await params).room, user));
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const s = await roomState((await params).room, user);
  if (!s.writable) throw new ApiError(403, tk("community", "errors.banned"));
  limitOrThrow(`community-chat:${user.id}`, 20, MINUTE);
  const { body } = await readBody(req, bodySchema, { maxBytes: MAX_MESSAGE * 4 });
  await db.communityMessage.create({ data: { projectId: s.projectId, authorId: user.id, body } });
  return reply(s, 201);
});
