import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { config } from "./config";

// Symmetrische Verschlüsselung für Geheimnisse in der Datenbank
// (TOTP-Schlüssel, später Git-Tokens). AES-256-GCM, Schlüssel per scrypt
// aus APP_SECRET. Format: v1.<iv>.<tag>.<daten>, jeweils base64url.

let cachedKey: { secret: string; key: Buffer } | null = null;

function key(): Buffer {
  const secret = config.secret;
  if (cachedKey?.secret !== secret) {
    cachedKey = { secret, key: scryptSync(secret, "vibeworks/aes-256-gcm/v1", 32) };
  }
  return cachedKey.key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Unbekanntes Chiffrat");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
