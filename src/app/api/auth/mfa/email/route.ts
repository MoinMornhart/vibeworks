import { ApiError, clientIp, json, route } from "@/lib/api";
import { readMfaPending } from "@/lib/auth/mfa";
import { MFA_EMAIL_CODE_MINUTES, sendMfaEmailCode } from "@/lib/auth/loginAlert";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

// Notfall-Code per E-Mail anfordern (#109) – nur im offenen Anmeldeschritt und
// nur, wenn das Konto diesen Weg erlaubt. Die Antwort verrät die Adresse nicht.
export const POST = route(async (req) => {
  limitOrThrow(`mfa-mail-ip:${clientIp(req)}`, 10, 15 * MINUTE);
  const pending = await readMfaPending();
  if (!pending) throw new ApiError(401, tk("auth", "errors.mfaExpired"));
  limitOrThrow(`mfa-mail:${pending.userId}`, 5, 15 * MINUTE);
  if (!(await sendMfaEmailCode(pending))) throw new ApiError(400, tk("auth", "errors.mfaEmailOff"));
  return json({ ok: true, minutes: MFA_EMAIL_CODE_MINUTES });
});
