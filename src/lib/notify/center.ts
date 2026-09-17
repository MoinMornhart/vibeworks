import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { NOTIFY_EVENTS, eventsOf, type NotifyEvent } from "./format";
import { matchesWords, readRules, type NotifyRules } from "./rulesLogic";

// Meldungen-Seite (#109): alle Benachrichtigungen mit Filtern, die eigenen
// Regeln und die offenen Aufgaben, die zu den wichtigen Wörtern passen.

const PAGE = 50;
const MAX_TASKS = 20;

export interface CenterFilter {
  /** Volltext in Titel und Text */
  q?: string;
  event?: NotifyEvent | null;
  unreadOnly?: boolean;
  limit?: number;
}

export async function notificationCenter(userId: string, filter: CenterFilter = {}) {
  const settings = await db.notificationSettings.findUnique({ where: { userId } });
  const rules = readRules(settings?.rules);
  const q = (filter.q ?? "").trim().slice(0, 100);
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(filter.unreadOnly ? { readAt: null } : {}),
    ...(filter.event ? { event: filter.event } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { message: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, unread, total, projects] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(filter.limit ?? PAGE, 200) }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.count({ where: { userId } }),
    db.project.findMany({ where: visibleTo(userId), orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
  ]);

  // Aufgaben zu den wichtigen Wörtern: offen, in sichtbaren Projekten
  const words = rules.words.slice(0, 10);
  const tasks = words.length
    ? await db.task.findMany({
        where: {
          project: visibleTo(userId),
          status: { not: "DONE" },
          OR: words.flatMap((w) => [{ title: { contains: w, mode: "insensitive" as const } }, { description: { contains: w, mode: "insensitive" as const } }]),
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: MAX_TASKS,
        select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
      })
    : [];

  return {
    items: rows.map((n) => ({
      id: n.id,
      event: n.event,
      title: n.title,
      message: n.message,
      url: n.url,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
      /** Passt zu einem wichtigen Wort – wird hervorgehoben */
      important: matchesWords(rules.words, `${n.title}\n${n.message}`),
    })),
    unread,
    total,
    rules,
    events: eventsOf(settings?.events),
    known: [...NOTIFY_EVENTS],
    projects,
    matchingTasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, projectId: t.projectId, project: t.project.name })),
  };
}
export type NotificationCenterView = Awaited<ReturnType<typeof notificationCenter>>;

/** Regeln speichern – nur bekannte Projekte, höchstens die erlaubte Zahl Einträge. */
export async function saveRules(userId: string, rules: NotifyRules): Promise<NotifyRules> {
  const ids = rules.projects.length ? (await db.project.findMany({ where: { id: { in: rules.projects }, ...visibleTo(userId) }, select: { id: true } })).map((p) => p.id) : [];
  const clean: NotifyRules = { words: rules.words, people: rules.people, projects: ids };
  await db.notificationSettings.upsert({
    where: { userId },
    create: { userId, rules: clean as unknown as Prisma.InputJsonValue },
    update: { rules: clean as unknown as Prisma.InputJsonValue },
  });
  return clean;
}
