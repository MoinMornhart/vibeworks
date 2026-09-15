import { z } from "zod";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { bellState } from "@/lib/notify/bell";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

// Eine Benachrichtigung als gelesen/ungelesen markieren – nur eigene, fremde: 404.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { read } = await readBody(req, z.object({ read: z.boolean() }), { maxBytes: 64 });
  const { count } = await db.notification.updateMany({ where: { id: (await params).id, userId: user.id }, data: { readAt: read ? new Date() : null } });
  if (!count) throw notFound(tk("shell", "topNav.bell.notFound"));
  return json(await bellState(user.id));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.notification.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) throw notFound(tk("shell", "topNav.bell.notFound"));
  return json(await bellState(user.id));
});
