import { addDaysKey, mondayOf } from "./weeks";

// Aktivität über das letzte Jahr: Gitter wie bei GitHub, Serien und kleine
// Erfolge. Ohne Datenbank – für Server, Oberfläche und Tests.

export const HEATMAP_WEEKS = 53;

export interface HeatCell {
  day: string;
  count: number;
}

export interface HeatmapGrid {
  /** Spalten = Wochen (Mo–So), null = Zukunft */
  weeks: Array<Array<HeatCell | null>>;
  /** true, wo in dieser Spalte ein neuer Monat beginnt */
  monthStarts: boolean[];
}

export function heatmapStart(today: string): string {
  return addDaysKey(mondayOf(today), -(HEATMAP_WEEKS - 1) * 7);
}

export function heatmapGrid(counts: Map<string, number>, today: string): HeatmapGrid {
  const start = heatmapStart(today);
  const weeks: HeatmapGrid["weeks"] = [];
  const monthStarts: boolean[] = [];
  let lastMonth = "";
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const column: Array<HeatCell | null> = [];
    for (let d = 0; d < 7; d++) {
      const day = addDaysKey(start, w * 7 + d);
      column.push(day > today ? null : { day, count: counts.get(day) ?? 0 });
    }
    const month = addDaysKey(start, w * 7).slice(0, 7);
    monthStarts.push(w > 0 && month !== lastMonth);
    lastMonth = month;
    weeks.push(column);
  }
  return { weeks, monthStarts };
}

/** Stufe 0–4 für die Farbe einer Zelle. */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/**
 * Aktuelle Serie: Tage am Stück mit Aktivität bis heute – ist heute noch
 * nichts passiert, zählt die Serie bis gestern (sie reißt erst morgen).
 */
export function streaks(counts: Map<string, number>, today: string): { current: number; longest: number } {
  const active = (day: string) => (counts.get(day) ?? 0) > 0;
  let current = 0;
  let day = active(today) ? today : addDaysKey(today, -1);
  while (active(day)) {
    current++;
    day = addDaysKey(day, -1);
  }
  const days = [...counts.keys()].filter((d) => (counts.get(d) ?? 0) > 0).sort();
  let longest = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDaysKey(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current) };
}

export const ACHIEVEMENTS = [
  { key: "firstProject", icon: "🌱", target: 1, metric: "projects" },
  { key: "ideas", icon: "💡", target: 10, metric: "projects" },
  { key: "shipped", icon: "🚀", target: 1, metric: "shipped" },
  { key: "tasks10", icon: "✅", target: 10, metric: "tasksDone" },
  { key: "tasks100", icon: "🏆", target: 100, metric: "tasksDone" },
  { key: "streak7", icon: "🔥", target: 7, metric: "longestStreak" },
  { key: "streak30", icon: "☄️", target: 30, metric: "longestStreak" },
  { key: "git", icon: "🔀", target: 1, metric: "repos" },
  { key: "live", icon: "🌐", target: 1, metric: "live" },
  { key: "writer", icon: "✍️", target: 25, metric: "writing" },
  { key: "gardener", icon: "🪦", target: 1, metric: "buried" },
] as const;

export type AchievementKey = (typeof ACHIEVEMENTS)[number]["key"];
export type Metrics = Record<(typeof ACHIEVEMENTS)[number]["metric"], number>;

export interface Achievement {
  key: AchievementKey;
  icon: string;
  target: number;
  value: number;
  done: boolean;
}

export function achievements(m: Metrics): Achievement[] {
  return ACHIEVEMENTS.map((a) => ({ key: a.key, icon: a.icon, target: a.target, value: Math.min(m[a.metric], a.target), done: m[a.metric] >= a.target }));
}
