import { z } from "zod";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { config } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { createInvite, listInvites } from "@/lib/invites";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const createSchema = z.object({
  note: z.string().trim().max(100).nullish(),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
});

export const GET = route(async () => {
  await requireApiAdmin();
  return json({ invites: await listInvites() });
});

// Einladung erzeugen – der Link kommt nur in dieser Antwort vor.
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  limitOrThrow(`invites:${admin.id}`, 30, 10 * MINUTE);
  if ((await getSettings()).mode !== "MULTI") throw new ApiError(409, tk("admin", "errors.multiOnly"));
  const input = await readBody(req, createSchema, { maxBytes: 1024 });
  const token = await createInvite(admin.id, { note: input.note || null, days: input.days });
  return json({ invites: await listInvites(), link: `${config.appUrl}/register?invite=${token}` }, { status: 201 });
});
