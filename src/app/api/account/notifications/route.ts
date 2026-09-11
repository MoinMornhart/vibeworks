import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { notificationView } from "@/lib/notify";
import { NOTIFY_EVENTS } from "@/lib/notify/format";
import { notificationSettingsSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ settings: notificationView(await db.notificationSettings.findUnique({ where: { userId: user.id } })) });
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`notify-settings:${user.id}`, 30, 10 * MINUTE);
  const input = await readBody(req, notificationSettingsSchema, { maxBytes: 8192 });
  // Nur bekannte Anlässe speichern
  const events = Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, input.events[e] !== false]));
  const data = {
    ntfyUrl: input.ntfyUrl,
    webhookUrl: input.webhookUrl,
    email: input.email,
    events,
    ...(input.ntfyToken !== undefined ? { ntfyTokenCipher: input.ntfyToken ? encrypt(input.ntfyToken) : null } : {}),
  };
  const saved = await db.notificationSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return json({ settings: notificationView(saved) });
});
