import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { displayNameOf } from "@/lib/auth/guard";
import type { Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/messages";
import { activityText, feedKind, type FeedKind } from "@/lib/activityText";
import type { CommitInfo } from "@/lib/git/providers";
import { dayKeyToDate } from "@/lib/taskDates";
import { addDaysKey } from "@/lib/weeks";
import { dayKey } from "@/lib/utils";

// Daten für Wochenrückblick und Zeitleiste: Verlaufseinträge aller sichtbaren
// Projekte (eigene und geteilte), dazu die Commits aus dem Repository-Stand.

export interface FeedItem {
  id: string;
  at: string;
  day: string;
  projectId: string;
  projectName: string;
  accent: string;
  kind: FeedKind;
  text: string;
  url: string | null;
  by: string | null;
}

interface FeedOptions {
  from?: Date;
  /** exklusiv */
  to?: Date;
  projectId?: string;
  limit?: number;
}

export async function loadFeed(userId: string, locale: Locale, opts: FeedOptions = {}): Promise<FeedItem[]> {
  const limit = opts.limit ?? 100;
  const projectWhere = { ...visibleTo(userId), ...(opts.projectId ? { id: opts.projectId } : {}) };
  const createdAt = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) };
  const [activities, caches] = await Promise.all([
    db.activity.findMany({
      where: { project: projectWhere, createdAt },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: { project: { select: { id: true, name: true, accent: true } }, user: { select: { username: true, displayName: true } } },
    }),
    db.repoCache.findMany({ where: { project: projectWhere }, select: { projectId: true, commits: true, project: { select: { name: true, accent: true } } } }),
  ]);

  const t = makeT(locale, "review");
  const ts = makeT(locale, "status");
  const items: FeedItem[] = activities.map((a) => ({
    id: a.id,
    at: a.createdAt.toISOString(),
    day: dayKey(a.createdAt),
    projectId: a.project.id,
    projectName: a.project.name,
    accent: a.project.accent,
    kind: feedKind(a),
    text: activityText(a, t, ts),
    url: null,
    by: a.user ? displayNameOf(a.user) : null,
  }));

  const fromMs = opts.from?.getTime() ?? -Infinity;
  const toMs = opts.to?.getTime() ?? Infinity;
  for (const cache of caches) {
    for (const c of (cache.commits as unknown as CommitInfo[]) ?? []) {
      const at = new Date(c.date);
      if (Number.isNaN(at.getTime()) || at.getTime() < fromMs || at.getTime() >= toMs) continue;
      items.push({
        id: `commit-${cache.projectId}-${c.sha}`,
        at: at.toISOString(),
        day: dayKey(at),
        projectId: cache.projectId,
        projectName: cache.project.name,
        accent: cache.project.accent,
        kind: "COMMIT",
        text: c.title,
        url: c.url,
        by: c.author,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function loadWeek(userId: string, locale: Locale, start: Date, end: Date, todayKey: string) {
  const projectWhere = visibleTo(userId);
  const [done, createdTasks, newProjects, statusChanges, upcoming, feed] = await Promise.all([
    db.task.findMany({
      where: { project: projectWhere, status: "DONE", doneAt: { gte: start, lt: end } },
      orderBy: { doneAt: "desc" },
      select: { id: true, title: true, doneAt: true, project: { select: { id: true, name: true, accent: true } } },
    }),
    db.task.count({ where: { project: projectWhere, createdAt: { gte: start, lt: end } } }),
    db.project.count({ where: { ...projectWhere, createdAt: { gte: start, lt: end } } }),
    db.activity.count({ where: { project: projectWhere, kind: "STATUS_CHANGED", createdAt: { gte: start, lt: end } } }),
    // Überfälliges und alles, was in den nächsten 7 Tagen fällig wird
    db.task.findMany({
      where: { project: { ...projectWhere, status: { not: "ARCHIVED" } }, status: { not: "DONE" }, dueDate: { not: null, lt: dayKeyToDate(addDaysKey(todayKey, 8)) } },
      orderBy: { dueDate: "asc" },
      take: 12,
      select: { id: true, title: true, dueDate: true, project: { select: { id: true, name: true, accent: true } } },
    }),
    loadFeed(userId, locale, { from: start, to: end, limit: 300 }),
  ]);

  // Erledigtes nach Projekt bündeln
  const doneByProject = new Map<string, { id: string; name: string; accent: string; tasks: Array<{ id: string; title: string }> }>();
  for (const task of done) {
    const group = doneByProject.get(task.project.id) ?? { ...task.project, tasks: [] };
    group.tasks.push({ id: task.id, title: task.title });
    doneByProject.set(task.project.id, group);
  }

  // Aktivste Projekte: Ereignisse und Commits der Woche
  const activity = new Map<string, { id: string; name: string; accent: string; count: number }>();
  for (const item of feed) {
    const entry = activity.get(item.projectId) ?? { id: item.projectId, name: item.projectName, accent: item.accent, count: 0 };
    entry.count++;
    activity.set(item.projectId, entry);
  }

  return {
    stats: {
      done: done.length,
      created: createdTasks,
      projects: newProjects,
      commits: feed.filter((i) => i.kind === "COMMIT").length,
      status: statusChanges,
    },
    doneByProject: [...doneByProject.values()].sort((a, b) => b.tasks.length - a.tasks.length),
    upcoming: upcoming.map((u) => ({ id: u.id, title: u.title, dueKey: dayKey(u.dueDate!), project: u.project })),
    active: [...activity.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    feed,
  };
}
