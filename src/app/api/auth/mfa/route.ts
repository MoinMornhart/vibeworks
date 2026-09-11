import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { mfaLoginSchema } from "@/lib/validation";
import { checkTotpForUser, clearMfa, MFA_MAX_ATTEMPTS, readMfaPending } from "@/lib/auth/mfa";
import { consumeRecoveryCode, recoveryCodesLeft } from "@/lib/auth/recovery";
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

  const ok = input.code ? await checkTotpForUser(user, input.code) : await consumeRecoveryCode(user.id, input.recoveryCode!);
  if (!ok) {
    await db.mfaPending.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(401, input.code ? tk("auth", "errors.wrongCode") : tk("auth", "errors.badRecovery"));
  }

  await clearMfa(pending.id);
  await startSession(user.id, req);
  return json({ ok: true, recoveryLeft: input.recoveryCode ? await recoveryCodesLeft(user.id) : undefined });
});
