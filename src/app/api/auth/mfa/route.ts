import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { mfaLoginSchema } from "@/lib/validation";
import { checkTotpForUser, clearMfa, MFA_MAX_ATTEMPTS, readMfaPending } from "@/lib/auth/mfa";
import { consumeRecoveryCode, recoveryCodesLeft } from "@/lib/auth/recovery";
import { alertLogin, checkMfaEmailCode } from "@/lib/auth/loginAlert";
import { startSession } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

// Zweiter Schritt der Anmeldung: Einmalkennwort oder Wiederherstellungscode.
export const POST = route(async (req) => {
  limitOrThrow(`mfa:${clientIp(req)}`, 30, 15 * MINUTE);
  const input = await readBody(req, mfaLoginSchema);

  const pending = await readMfaPending();
  if (!pending) throw new ApiError(401, tk("auth", "errors.mfaExpired"));
  if (pending.attempts >= MFA_MAX_ATTEMPTS) {
    await clearMfa(pending.id);
    throw new ApiError(401, tk("auth", "errors.mfaTooMany"));
  }
  const { user } = pending;
  if (!user.active) {
    await clearMfa(pending.id);
    throw new ApiError(403, tk("auth", "errors.deactivated"));
  }

  // Drei Wege: Code aus der App, Wiederherstellungscode oder Code per E-Mail (#109)
  const method = input.code ? "totp" : input.recoveryCode ? "recovery" : "email";
  const ok =
    method === "totp"
      ? await checkTotpForUser(user, input.code!)
      : method === "recovery"
        ? await consumeRecoveryCode(user.id, input.recoveryCode!)
        : checkMfaEmailCode(pending, input.emailCode!);
  if (!ok) {
    await db.mfaPending.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(401, method === "totp" ? tk("auth", "errors.wrongCode") : method === "recovery" ? tk("auth", "errors.badRecovery") : tk("auth", "errors.badEmailCode"));
  }

  await clearMfa(pending.id);
  await startSession(user.id, req);
  // Notfallweg benutzt: nachfragen, ob das gewollt war
  if (method !== "totp") await alertLogin(user, method, req).catch((err) => console.warn("[login-check]", err instanceof Error ? err.message : err));
  return json({ ok: true, recoveryLeft: method === "recovery" ? await recoveryCodesLeft(user.id) : undefined });
});
