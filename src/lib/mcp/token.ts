import type { ApiToken } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

// API-Schlüssel für Claude Code und andere MCP-Clients. Der Schlüssel selbst
// wird nur einmal beim Erstellen gezeigt; gespeichert ist allein sein
// SHA-256 (256 Bit Zufall – ein langsamer Hash brächte nichts).

export const TOKEN_PREFIX = "vw_";
export const MAX_TOKENS = 20;

export function newApiToken() {
  const token = `${TOKEN_PREFIX}${randomToken(32)}`;
  return { token, hash: sha256(token), hint: `${token.slice(0, 7)}…${token.slice(-4)}` };
}

export function bearerOf(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m || !m[1].startsWith(TOKEN_PREFIX) || m[1].length > 200) return null;
  return m[1];
}

/** Konto zum Bearer-Schlüssel – null bei unbekanntem, widerrufenem Schlüssel oder gesperrtem Konto. */
export async function authenticateApiToken(header: string | null) {
  const token = bearerOf(header);
  if (!token) return null;
  const row = await db.apiToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, username: true, displayName: true, role: true, active: true, locale: true } } },
  });
  if (!row || !row.user.active) return null;
  // „Zuletzt benutzt“ höchstens einmal pro Minute schreiben
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { tokenId: row.id, user: row.user };
}
export type ApiTokenAuth = NonNullable<Awaited<ReturnType<typeof authenticateApiToken>>>;

export function serializeApiToken(t: ApiToken) {
  return { id: t.id, name: t.name, hint: t.hint, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() };
}
export type ApiTokenItem = ReturnType<typeof serializeApiToken>;
