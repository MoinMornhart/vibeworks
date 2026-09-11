import { db } from "@/lib/db";
import { visibleTo } from "@/lib/access";
import { CHANGELOG } from "@/lib/changelog";
import { getSettings } from "@/lib/settings";
import { dayKeyToDate, formatDue } from "@/lib/taskDates";
import { addDaysKey } from "@/lib/weeks";
import { dayKey, TIME_ZONE } from "@/lib/utils";
import { eventsOf } from "./format";
import { appLink, notifyUser } from "./index";

// Zeitgesteuerte Benachrichtigungen: morgens die fälligen Aufgaben, nach
// einem Update einmal „VibeWorks aktualisiert“ an die Admins.

const DIGEST_HOUR = 8;

function zoneHour(at: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(at));
}

/** Zusammenfassung fälliger und überfälliger Aufgaben – einmal am Tag ab 8 Uhr. */
export async function runDigest(now = new Date()): Promise<number> {
  if (zoneHour(now) < DIGEST_HOUR) return 0;
  const today = dayKey(now);
  const rows = await db.notificationSettings.findMany({
    where: { OR: [{ digestSentOn: null }, { digestSentOn: { not: today } }] },
    select: { userId: true, events: true },
  });
  let sent = 0;
  for (const row of rows) {
    await db.notificationSettings.update({ where: { userId: row.userId }, data: { digestSentOn: today } });
    if (!eventsOf(row.events).taskDue) continue;
    const tasks = await db.task.findMany({
      where: { project: { ...visibleTo(row.userId), status: { not: "ARCHIVED" } }, status: { not: "DONE" }, dueDate: { not: null, lt: dayKeyToDate(addDaysKey(today, 1)) } },
      orderBy: { dueDate: "asc" },
      take: 20,
      select: { title: true, dueDate: true, project: { select: { name: true } } },
    });
    if (!tasks.length) continue;
    await notifyUser(row.userId, "taskDue", (t, locale) => ({
      event: "taskDue",
      title: t("events.taskDue.title", { n: tasks.length }),
      message: tasks.map((x) => `• ${x.title} (${x.project.name}) – ${formatDue(dayKey(x.dueDate!), today, locale)}`).join("\n"),
      url: appLink("/tasks"),
      priority: tasks.some((x) => dayKey(x.dueDate!) < today) ? "high" : "default",
    }));
    sent++;
  }
  return sent;
}

/** Nach einem Update einmal die Admins benachrichtigen. Beim allerersten Start nicht. */
export async function runVersionCheck(): Promise<void> {
  const entry = CHANGELOG[0];
  if (!entry) return;
  const settings = await getSettings();
  if (settings.lastVersion === entry.version) return;
  await db.settings.update({ where: { id: "instance" }, data: { lastVersion: entry.version } });
  if (!settings.lastVersion) return;
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  for (const admin of admins) {
    await notifyUser(admin.id, "updated", (t, locale) => ({
      event: "updated",
      title: t("events.updated.title", { version: entry.version }),
      message: locale === "en" ? (entry.titleEn ?? entry.title) : entry.title,
      url: appLink("/"),
    }));
  }
}

const g = globalThis as typeof globalThis & { __vwNotifyScheduler?: boolean };

export function startNotifyScheduler() {
  if (g.__vwNotifyScheduler) return;
  g.__vwNotifyScheduler = true;
  const log = (err: unknown) => console.error("[notify]", err);
  setTimeout(() => void runVersionCheck().catch(log), 15_000).unref?.();
  const tick = () => void runDigest().catch(log);
  setTimeout(tick, 30_000).unref?.();
  setInterval(tick, 10 * 60_000).unref?.();
}
