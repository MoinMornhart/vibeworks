import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { serializeApiToken } from "@/lib/mcp/token";
import { keySettingsSchema } from "@/lib/mcp/keySettings";

type Params = { id: string };

// Einstellungen eines Schlüssels (#48/#49): Werkzeug-Umfang und Erinnerungen – nur für den eigenen.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const input = await readBody(req, keySettingsSchema, { maxBytes: 4096 });
  const { count } = await db.apiToken.updateMany({ where: { id: (await params).id, userId: user.id }, data: { ...input, reminderText: input.reminderText || null } });
  if (!count) throw notFound(tk("mcp", "errors.notFound"));
  const row = await db.apiToken.findUniqueOrThrow({ where: { id: (await params).id } });
  return json({ item: serializeApiToken(row) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.apiToken.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) throw notFound(tk("mcp", "errors.notFound"));
  return json({ ok: true });
});
