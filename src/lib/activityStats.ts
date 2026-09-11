import { db } from "./db";
import { visibleTo } from "./access";
import { achievements, heatmapGrid, heatmapStart, streaks, type Achievement, type HeatmapGrid } from "./stats";
import { zonedMidnight } from "./weeks";
import { dayKey } from "./utils";

// Aktivität eines Kontos über das letzte Jahr: eigene Einträge im Verlauf
// plus Commits in den Repositories der eigenen Projekte.

export interface ActivityStats {
  grid: HeatmapGrid;
  current: number;
  longest: number;
  activeDays: number;
  total: number;
  achievements: Achievement[];
}

export async function loadActivityStats(userId: string, today: string): Promise<ActivityStats> {
  const start = heatmapStart(today);
  const since = zonedMidnight(start);
  const [rows, repos, projects, shipped, tasksDone, repoProjects, live, buried, notes, docs] = await Promise.all([
    db.$queryRaw<Array<{ day: string; n: bigint }>>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS "day", count(*) AS "n"
      FROM "Activity"
      WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY 1`,
    db.repoCache.findMany({ where: { project: { ownerId: userId } }, select: { commits: true } }),
    db.project.count({ where: { ownerId: userId } }),
    db.project.count({ where: { ownerId: userId, status: "DONE" } }),
    db.task.count({ where: { status: "DONE", project: visibleTo(userId) } }),
    db.project.count({ where: { ownerId: userId, repoUrl: { not: null } } }),
    db.project.count({ where: { ownerId: userId, liveState: "up" } }),
    db.project.count({ where: { ownerId: userId, buriedAt: { not: null } } }),
    db.note.count({ where: { project: { ownerId: userId } } }),
    db.doc.count({ where: { ownerId: userId } }),
  ]);

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.day, Number(r.n));
  for (const repo of repos) {
    if (!Array.isArray(repo.commits)) continue;
    for (const c of repo.commits as Array<{ date?: string }>) {
      const at = c?.date ? new Date(c.date) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      const day = dayKey(at);
      if (day >= start && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  const { current, longest } = streaks(counts, today);
  const values = [...counts.values()];
  return {
    grid: heatmapGrid(counts, today),
    current,
    longest,
    activeDays: values.filter((n) => n > 0).length,
    total: values.reduce((a, b) => a + b, 0),
    achievements: achievements({ projects, shipped, tasksDone, longestStreak: longest, repos: repoProjects, live, writing: notes + docs, buried }),
  };
}
