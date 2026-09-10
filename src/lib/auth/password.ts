import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Passwort-Hashing mit scrypt (OWASP: N=2^17, r=8, p=1). Die Parameter
// stehen im Hash selbst, ältere Hashes bleiben also prüfbar und werden bei
// der nächsten erfolgreichen Anmeldung still auf den aktuellen Stand gehoben.

const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 };
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return { ok: false, needsRehash: false };
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isInteger) || n > 2 ** 20) return { ok: false, needsRehash: false };
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  const actual = await scrypt(password, salt, n, r, p);
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
  return { ok, needsRehash: ok && (n !== N || r !== R || p !== P) };
}

let dummyHash: Promise<string> | null = null;

/** Gleiche Rechenzeit für unbekannte Konten – verrät nicht, ob es sie gibt. */
export async function fakeVerify(password: string): Promise<void> {
  dummyHash ??= hashPassword("vibeworks-dummy-passwort");
  await verifyPassword(password, await dummyHash);
}

// ── Passwortregeln ──────────────────────────────────────────
// Länge statt Zusammensetzungsregeln (NIST 800-63B / ASVS 2.1.9): Sonderzeichen-
// Pflicht führt zu "Passwort1!", nicht zu mehr Entropie.

const COMMON = new Set([
  "passwort", "password", "passwort123", "password123", "123456789", "1234567890", "qwertzuiop",
  "qwertyuiop", "hallo123", "hallohallo", "letmein", "iloveyou", "admin", "administrator",
  "vibeworks", "willkommen", "welcome", "geheim", "sommer", "winter", "fussball", "football",
  "schatz", "passwort1", "password1", "00000000", "11111111", "abc123456", "master",
]);

function isSequence(s: string): boolean {
  if (s.length < 4) return false;
  const step = s.charCodeAt(1) - s.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let i = 2; i < s.length; i++) if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false;
  return true;
}

export const PASSWORD_MIN = 10;

/** null = in Ordnung, sonst eine verständliche Begründung. */
export function checkPasswordPolicy(password: string, username?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Mindestens ${PASSWORD_MIN} Zeichen.`;
  if (password.length > 256) return "Höchstens 256 Zeichen.";
  const lower = password.toLowerCase();
  if (/^\d+$/.test(password)) return "Nicht nur Ziffern.";
  if (new Set(password).size < 5) return "Zu wenige verschiedene Zeichen.";
  if (isSequence(lower)) return "Keine durchlaufende Zeichenfolge.";
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[\d!?.]+$/, ""))) return "Dieses Passwort ist zu naheliegend.";
  if (username && username.length >= 3 && lower.includes(username.toLowerCase())) return "Das Passwort darf den Benutzernamen nicht enthalten.";
  return null;
}
