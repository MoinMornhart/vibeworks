import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { randomToken } from "@/lib/crypto";
import { inboxSettingsSchema } from "@/lib/validation";
import { inboxInfo } from "@/lib/inboxServer";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ inbox: await inboxInfo(user.id) });
});

// ntfy-Thema setzen, Einwurf-Adresse erneuern (die alte gilt dann nicht mehr)
export const PUT = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`inbox-settings:${user.id}`, 20, 10 * MINUTE);
  const { ntfyUrl, regenerate } = await readBody(req, inboxSettingsSchema, { maxBytes: 2048 });
  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { inboxNtfyUrl: true } });
  await db.user.update({
    where: { id: user.id },
    data: {
      inboxNtfyUrl: ntfyUrl,
      ...(ntfyUrl !== current.inboxNtfyUrl ? { inboxNtfySince: null } : {}),
      ...(regenerate ? { inboxToken: randomToken(24) } : {}),
    },
  });
  return json({ inbox: await inboxInfo(user.id) });
});
