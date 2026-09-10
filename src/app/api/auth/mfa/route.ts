import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { mfaLoginSchema } from "@/lib/validation";
import { checkTotpForUser, clearMfa, MFA_MAX_ATTEMPTS, readMfaPending } from "@/lib/auth/mfa";
import { consumeRecoveryCode, recoveryCodesLeft } from "@/lib/auth/recovery";
import { startSession } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Zweiter Schritt der Anmeldung: Einmalkennwort oder Wiederherstellungscode.
export const POST = route(async (req) => {
  limitOrThrow(`mfa:${clientIp(req)}`, 30, 15 * MINUTE);
  const input = await readBody(req, mfaLoginSchema);

  const pending = await readMfaPending();
  if (!pending) throw new ApiError(401, "Die Anmeldung ist abgelaufen – bitte noch einmal mit Passwort anmelden.");
  if (pending.attempts >= MFA_MAX_ATTEMPTS) {
    await clearMfa(pending.id);
    throw new ApiError(401, "Zu viele Fehlversuche – bitte noch einmal mit Passwort anmelden.");
  }
  const { user } = pending;
  if (!user.active) {
    await clearMfa(pending.id);
    throw new ApiError(403, "Dieses Konto ist deaktiviert.");
  }

  const ok = input.code ? await checkTotpForUser(user, input.code) : await consumeRecoveryCode(user.id, input.recoveryCode!);
  if (!ok) {
    await db.mfaPending.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(401, input.code ? "Der Code stimmt nicht." : "Dieser Wiederherstellungscode ist ungültig oder schon verbraucht.");
  }

  await clearMfa(pending.id);
  await startSession(user.id, req);
  return json({ ok: true, recoveryLeft: input.recoveryCode ? await recoveryCodesLeft(user.id) : undefined });
});
