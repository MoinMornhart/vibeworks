import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { decrypt, randomToken, sha256 } from "@/lib/crypto";
import { ApiError } from "@/lib/api";
import { verifyPassword } from "./password";
import { verifyTotp } from "./totp";

// Zwischenschritt zwischen Passwort und zweitem Faktor. Bewusst keine
// halbe Sitzung: aus diesem Zustand entsteht nichts, was einer Anmeldung
// ähnelt. Fünf Minuten gültig, höchstens fünf Versuche.

const PENDING_MINUTES = 5;
export const MFA_MAX_ATTEMPTS = 5;

function cookieName() {
  return config.secureCookies ? "__Host-vw_mfa" : "vw_mfa";
}

export async function startMfa(userId: string) {
  const token = randomToken(32);
  await db.mfaPending.deleteMany({ where: { userId } });
  await db.mfaPending.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + PENDING_MINUTES * 60_000) },
  });
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: PENDING_MINUTES * 60,
  });
}

export async function readMfaPending() {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  const pending = await db.mfaPending.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    if (pending) await db.mfaPending.delete({ where: { id: pending.id } }).catch(() => {});
    return null;
  }
  return pending;
}

export async function clearMfa(id?: string) {
  if (id) await db.mfaPending.delete({ where: { id } }).catch(() => {});
  (await cookies()).delete(cookieName());
}

/** Prüft einen TOTP-Code gegen das Konto und merkt sich das Zeitfenster. */
export async function checkTotpForUser(user: { id: string; totpSecret: string | null; totpLastStep: number | null }, code: string): Promise<boolean> {
  if (!user.totpSecret) return false;
  let secret: string;
  try {
    secret = decrypt(user.totpSecret);
  } catch {
    return false;
  }
  const step = verifyTotp(secret, code, user.totpLastStep);
  if (step === null) return false;
  await db.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  return true;
}

/**
 * Bestätigung für heikle Änderungen (2FA abschalten, Codes neu erzeugen):
 * wer ein Passwort hat, gibt es ein – sonst genügt ein aktueller Code.
 * Eine offene Sitzung allein reicht nicht.
 */
export async function confirmIdentity(userId: string, input: { password?: string; code?: string }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash) {
    const ok = input.password ? (await verifyPassword(input.password, user.passwordHash)).ok : false;
    if (!ok) throw new ApiError(400, "Das Passwort stimmt nicht.", { password: "Stimmt nicht" });
    return user;
  }
  if (!input.code || !(await checkTotpForUser(user, input.code))) {
    throw new ApiError(400, "Der Code stimmt nicht.", { code: "Stimmt nicht" });
  }
  return user;
}
