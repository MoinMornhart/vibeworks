import { z } from "zod";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { answerLoginCheck, readLoginCheck } from "@/lib/auth/loginAlert";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

// Nachfrage nach einer Notfall-Anmeldung (#109): bestätigen oder alle
// Sitzungen beenden. Ohne Anmeldung – der Link aus der E-Mail ist der Nachweis.
// Nur per POST von unserer eigenen Seite, damit kein Vorschau-Aufruf eines
// Mailprogramms etwas auslöst.

const schema = z.object({ token: z.string().min(10).max(200), action: z.enum(["ok", "revoked"]) });

export const GET = route(async (req) => {
  limitOrThrow(`login-check:${clientIp(req)}`, 30, 15 * MINUTE);
  const token = req.nextUrl.searchParams.get("token") ?? "";
  return json({ check: token ? await readLoginCheck(token) : null });
});

export const POST = route(async (req) => {
  limitOrThrow(`login-check:${clientIp(req)}`, 30, 15 * MINUTE);
  const { token, action } = await readBody(req, schema, { maxBytes: 512 });
  const check = await answerLoginCheck(token, action);
  if (!check) throw new ApiError(404, tk("auth", "mfa.check.gone"));
  return json({ check });
});
