import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { confirmIdentity } from "@/lib/auth/mfa";
import { replaceRecoveryCodes } from "@/lib/auth/recovery";
import { confirmIdentitySchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Neue Wiederherstellungscodes – die alten werden damit ungültig.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  if (!user.totpEnabledAt) throw new ApiError(400, "Zwei-Faktor ist nicht eingerichtet.");
  limitOrThrow(`totp-confirm:${user.id}`, 10, 10 * MINUTE);
  await confirmIdentity(user.id, await readBody(req, confirmIdentitySchema));
  return json({ codes: await replaceRecoveryCodes(user.id) });
});
