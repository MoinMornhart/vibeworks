import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

// Wiederherstellungscodes für den Fall, dass der Authenticator weg ist.
// Zufällig und lang genug, dass SHA-256 als Ablage reicht – ein langsames
// Verfahren wie bei Passwörtern hieße zehn teure Vergleiche je Anmeldung.

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // ohne l/1, o/0, i
export const RECOVERY_COUNT = 10;

export function generateRecoveryCode(): string {
  const chars = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return sha256(`vw-recovery:${normalizeRecoveryCode(code)}`);
}

/** Alte Codes verwerfen, zehn neue anlegen. Die Klartexte gibt es nur hier. */
export async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_COUNT }, generateRecoveryCode);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

/** Löst einen Code ein – genau einmal. */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  if (normalizeRecoveryCode(code).length !== 10) return false;
  const { count } = await db.recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

export async function recoveryCodesLeft(userId: string): Promise<number> {
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}
