import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { AWAKE_STATUSES, lastSign, SLEEP_DAYS } from "@/lib/grave";
import { dayKey } from "@/lib/utils";
import { addDaysKey, isoWeek, mondayOf, zonedMidnight } from "@/lib/weeks";
import { appLink, notifyUser } from "./index";
import { isEmptyReport, provenSteps, weeklyReportText, type WeeklyReportData } from "./weeklyReportLogic";

// Wochenbericht (#82): montags ab 8 Uhr (oder beim ersten Lauf danach) je
// Konto einmal, was in der Vorwoche passiert ist – über die vorhandenen Kanäle.

const DAY = 86_400_000;

async function collect(userId: string, from: Date, to: Date, now: Date): Promise<WeeklyReportData> {
  const visible = visibleTo(userId);
  const [done, doneTotal, runs, errors, owned] = await Promise.all([
    db.task.findMany({
      where: { project: visible, status: "DONE", doneAt: { gte: from, lt: to } },
      orderBy: { doneAt: "desc" },
      take: 5,
      select: { title: true, project: { select: { name: true } } },
    }),
    db.task.count({ where: { project: visible, status: "DONE", doneAt: { gte: from, lt: to } } }),
    db.workflowRun.findMany({
      where: { project: visible, status: "done", finishedAt: { gte: from, lt: to } },
      orderBy: { finishedAt: "desc" },
      take: 20,
      select: { title: true, steps: true, results: true, project: { select: { name: true } } },
    }),
    db.appError.groupBy({ by: ["projectId"], where: { project: visible, firstSeen: { gte: from, lt: to } }, _count: { _all: true } }),
    db.project.findMany({
      where: { ownerId: userId, status: { in: AWAKE_STATUSES }, favorite: false, buriedAt: null },
      select: { name: true, updatedAt: true, nudgeSnoozedUntil: true, repoCache: { select: { commits: true } } },
    }),
  ]);
  const errorNames = errors.length ? await db.project.findMany({ where: { id: { in: errors.map((e) => e.projectId) } }, select: { id: true, name: true } }) : [];
  return {
    done: done.map((x) => ({ title: x.title, project: x.project.name })),
    doneTotal,
    runs: runs.map((r) => ({ title: r.title, project: r.project.name, steps: Array.isArray(r.steps) ? r.steps.length : 0, proven: provenSteps(r.results) })),
    errors: errors
      .map((e) => ({ project: errorNames.find((p) => p.id === e.projectId)?.name ?? "?", count: e._count._all }))
      .sort((a, b) => b.count - a.count),
    sleeping: owned
      .filter((p) => !p.nudgeSnoozedUntil || p.nudgeSnoozedUntil <= now)
      .map((p) => ({ project: p.name, days: Math.floor((now.getTime() - lastSign(p.updatedAt, p.repoCache?.commits).getTime()) / DAY) }))
      .filter((p) => p.days >= SLEEP_DAYS)
      .sort((a, b) => b.days - a.days),
  };
}

/** Liefert die Zahl verschickter Berichte. Die Stunde prüft der Aufrufer. */
export async function runWeeklyReports(now = new Date()): Promise<number> {
  const monday = mondayOf(dayKey(now));
  const from = zonedMidnight(addDaysKey(monday, -7));
  const to = zonedMidnight(monday);
  const users = await db.user.findMany({
    where: { active: true, OR: [{ notificationSettings: null }, { notificationSettings: { OR: [{ weeklyReportOn: null }, { weeklyReportOn: { not: monday } }] } }] },
    select: { id: true, notificationSettings: { select: { weeklyReportOn: true } } },
  });
  let sent = 0;
  for (const u of users) {
    // Erst vermerken, dann senden – ein Fehler schickt den Bericht nicht zehnmal
    await db.notificationSettings.upsert({ where: { userId: u.id }, create: { userId: u.id, weeklyReportOn: monday }, update: { weeklyReportOn: monday } });
    // Noch nie berichtet (etwa direkt nach dem Update): erst ab dem nächsten Montag, nicht mitten in der Woche
    if (!u.notificationSettings?.weeklyReportOn && dayKey(now) !== monday) continue;
    const data = await collect(u.id, from, to, now);
    if (isEmptyReport(data)) continue;
    await notifyUser(u.id, "weeklyReport", (t) => {
      const tr = (key: string, vars?: Record<string, string | number>) => t(`events.weeklyReport.${key}` as Parameters<typeof t>[0], vars);
      return {
        event: "weeklyReport",
        title: tr("title", { week: isoWeek(addDaysKey(monday, -7)) }),
        message: weeklyReportText(data, tr),
        url: appLink("/review"),
      };
    });
    sent++;
  }
  return sent;
}
