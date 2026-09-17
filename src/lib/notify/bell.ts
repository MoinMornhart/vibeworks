import { db } from "@/lib/db";

// Glocke in der Kopfleiste: die neuesten Benachrichtigungen eines Kontos und
// wie viele davon ungelesen sind. Ältere als 30 Tage räumt der Planer ab.

const BELL_LIMIT = 20;

export async function bellState(userId: string) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: BELL_LIMIT }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    items: items.map((n) => ({
      id: n.id,
      event: n.event,
      title: n.title,
      message: n.message,
      url: n.url,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
    unread,
  };
}
export type BellState = Awaited<ReturnType<typeof bellState>>;
