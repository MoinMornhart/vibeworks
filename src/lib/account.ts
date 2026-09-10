import { db } from "./db";
import { describeUserAgent } from "./userAgent";

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true },
  });
  return sessions.map((s) => ({
    id: s.id,
    ...describeUserAgent(s.userAgent),
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    current: s.id === currentSessionId,
  }));
}
export type SessionItem = Awaited<ReturnType<typeof listSessions>>[number];
