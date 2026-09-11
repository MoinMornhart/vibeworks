import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { visibleTo } from "@/lib/access";
import { serializeTask } from "@/lib/tasks";
import { dayKeyToDate } from "@/lib/taskDates";
import { addDaysKey, zonedMidnight } from "@/lib/weeks";
import { dayKey } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { TodayView } from "@/components/today/TodayView";
import { sumSeconds } from "@/lib/timeServer";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("today");
  return { title: t("title") };
}

const projectRef = { select: { id: true, name: true, accent: true } } as const;

export default async function TodayPage() {
  const user = await requirePageUser();
  const today = dayKey(new Date());
  await db.taskFocus.deleteMany({ where: { userId: user.id, day: { lt: today } } });
  const [focus, candidates, doneToday, timeToday] = await Promise.all([
    db.taskFocus.findMany({
      where: { userId: user.id, day: today },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { task: { include: { project: projectRef } } },
    }),
    // Vorschläge: überfällig, heute fällig oder schon in Arbeit
    db.task.findMany({
      where: {
        status: { not: "DONE" },
        project: { ...visibleTo(user.id), status: { not: "ARCHIVED" } },
        OR: [{ status: "DOING" }, { dueDate: { lt: dayKeyToDate(addDaysKey(today, 1)) } }],
      },
      include: { project: projectRef },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { statusChangedAt: "desc" }],
      take: 20,
    }),
    db.task.count({ where: { project: visibleTo(user.id), doneAt: { gte: zonedMidnight(today) } } }),
    sumSeconds({ userId: user.id, from: zonedMidnight(today) }),
  ]);
  const chosen = new Set(focus.map((f) => f.taskId));
  return (
    <TodayView
      today={today}
      doneToday={doneToday}
      timeToday={timeToday}
      focus={focus.map((f) => ({ ...serializeTask(f.task), project: f.task.project }))}
      suggestions={candidates
        .filter((t) => !chosen.has(t.id))
        .slice(0, 8)
        .map((t) => ({ ...serializeTask(t), project: t.project }))}
    />
  );
}
