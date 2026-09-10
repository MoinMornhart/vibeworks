import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { getAuth } from "@/lib/auth/guard";
import { passwordChangeSchema } from "@/lib/validation";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllSessions, startSession } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Eigenes Passwort setzen oder wechseln. Wer schon eines hat, muss es
// bestätigen. Danach sind alle Sitzungen ungültig – das eigene Gerät
// bekommt sofort eine neue, bleibt also angemeldet.
export const POST = route(async (req) => {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "Nicht angemeldet");
  const { user } = auth;
  limitOrThrow(`password:${user.id}`, 10, 15 * MINUTE);
  const input = await readBody(req, passwordChangeSchema);

  if (user.passwordHash) {
    const ok = input.currentPassword ? (await verifyPassword(input.currentPassword, user.passwordHash)).ok : false;
    if (!ok) throw new ApiError(400, "Das aktuelle Passwort stimmt nicht.", { currentPassword: "Stimmt nicht" });
  }
  const policy = checkPasswordPolicy(input.newPassword, user.username);
  if (policy) throw new ApiError(400, policy, { newPassword: policy });

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await destroyAllSessions(user.id);
  await startSession(user.id, req);
  return json({ ok: true });
});
