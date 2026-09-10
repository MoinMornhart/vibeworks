import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { randomToken, sha256 } from "@/lib/crypto";
import { clientIp } from "@/lib/api";

// Serverseitige Sitzungen. Der Browser bekommt ein Zufallstoken (256 Bit),
// in der Datenbank liegt nur dessen SHA-256 – ein Datenbankleck ergibt so
// keine übernehmbaren Sitzungen. Zwei Fristen: absolut (SESSION_TTL_DAYS)
// und im Leerlauf (SESSION_IDLE_HOURS).

export function sessionCookieName(): string {
  return config.secureCookies ? "__Host-vw_session" : "vw_session";
}

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  active: true,
  theme: true,
  totpEnabledAt: true,
  passwordHash: true,
  createdAt: true,
} as const;

export async function createSession(userId: string, req?: NextRequest) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 86_400_000);
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: req?.headers.get("user-agent")?.slice(0, 300) ?? null,
      ip: req ? clientIp(req) : null,
    },
  });
  return { token, expiresAt, id: session.id };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(sessionCookieName());
}

/** Sitzung anlegen, Cookie setzen, Anmeldezeitpunkt vermerken. */
export async function startSession(userId: string, req: NextRequest) {
  const { token, expiresAt, id } = await createSession(userId, req);
  await setSessionCookie(token, expiresAt);
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return id;
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: publicUserSelect } },
  });
  if (!session) return null;
  const now = Date.now();
  const idleMs = config.sessionIdleHours * 3_600_000;
  const expired = session.expiresAt.getTime() < now || (idleMs > 0 && session.lastSeenAt.getTime() + idleMs < now);
  if (expired || !session.user.active) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Letzte Aktivität höchstens alle fünf Minuten schreiben.
  if (now - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return { sessionId: session.id, user: session.user };
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function destroyAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
