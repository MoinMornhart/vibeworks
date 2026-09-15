import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { messageForChange, requireCommunity } from "@/lib/community";
import { canDelete, canModerate } from "@/lib/communityLogic";
import { tk } from "@/lib/i18n/messages";

type Params = { messageId: string };

const patchSchema = z.object({ hidden: z.boolean() });

const forbidden = () => new ApiError(403, tk("community", "errors.notAllowed"));

// Ausblenden: Moderation (im Projekt der Besitzer, in der Lobby Admins). Löschen: Autor oder Moderation.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { message, ownerId } = await messageForChange((await params).messageId);
  if (!canModerate(v, ownerId)) throw forbidden();
  const { hidden } = await readBody(req, patchSchema, { maxBytes: 256 });
  await db.communityMessage.update({ where: { id: message.id }, data: { hidden } });
  return json({ ok: true });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { message, ownerId } = await messageForChange((await params).messageId);
  if (!canDelete(v, message.authorId, ownerId)) throw forbidden();
  await db.$transaction([
    db.communityReport.deleteMany({ where: { targetType: "message", targetId: message.id } }),
    db.communityMessage.delete({ where: { id: message.id } }),
  ]);
  return json({ ok: true });
});
