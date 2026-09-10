import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const GENERIC = "Benutzername oder Passwort ist falsch.";
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

// Anmeldung mit Benutzername und Passwort. Bis das Passwort stimmt, sieht
// jede fehlgeschlagene Anmeldung gleich aus – Text und Dauer –, damit sich
// nicht ausprobieren lässt, welche Konten existieren.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  limitOrThrow(`login:ip:${ip}`, 30, 15 * MINUTE);
  const input = await readBody(req, loginSchema);
  limitOrThrow(`login:user:${input.username}`, 12, 15 * MINUTE);

  const user = await db.user.findUnique({ where: { username: input.username } });
  if (!user || !user.passwordHash) {
    await fakeVerify(input.password);
    throw new ApiError(401, GENERIC);
  }

  const { ok, needsRehash } = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const fails = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: fails >= MAX_FAILS ? 0 : fails,
        lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * MINUTE) : user.lockedUntil,
      },
    });
    throw new ApiError(401, GENERIC);
  }

  // Ab hier stimmt das Passwort – jetzt darf die Antwort genauer werden.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new ApiError(423, `Zu viele Fehlversuche – das Konto ist bis ${user.lockedUntil.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr gesperrt.`);
  }
  if (!user.active) throw new ApiError(403, "Dieses Konto ist deaktiviert.");

  if (needsRehash) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
  }

  await startSession(user.id, req);
  return json({ ok: true });
});
