import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { inboxAddSchema } from "@/lib/validation";
import { addInboxItem, serializeInbox } from "@/lib/inboxServer";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  const items = await db.inboxItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return json({ items: items.map(serializeInbox) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`inbox:${user.id}`, 60, 10 * MINUTE);
  const input = await readBody(req, inboxAddSchema, { maxBytes: 16 * 1024 });
  const item = await addInboxItem(user.id, input);
  return json({ item: item ? serializeInbox(item) : null }, { status: 201 });
});
