import { db } from "@/lib/db";
import { ApiError, clientIp, json, route } from "@/lib/api";
import { config } from "@/lib/config";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";
import { DEMO_USERNAME } from "@/lib/demoGuard";

// Demo-Instanz: ohne Passwort ins gemeinsame Demo-Konto. Die Sitzung wird
// ohne IP und Browser gespeichert – alle Besucher teilen sich das Konto und
// sähen unter „Sitzungen“ sonst gegenseitig ihre Adressen.
export const POST = route(async (req) => {
  if (!config.demoMode) throw new ApiError(404, "errors.notFound");
  limitOrThrow(`demo-login:${clientIp(req)}`, 20, 15 * MINUTE);
  const user = await db.user.findUnique({ where: { username: DEMO_USERNAME }, select: { id: true, active: true } });
  if (!user?.active) throw new ApiError(503, tk("demo", "errors.notReady"));
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  return json({ ok: true });
});
