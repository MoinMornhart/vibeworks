import { describe, expect, it } from "vitest";
import { achievements, heatLevel, heatmapGrid, heatmapStart, HEATMAP_WEEKS, streaks } from "./stats";

const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("Heatmap", () => {
  it("53 Wochen ab einem Montag, nichts nach heute", () => {
    const today = "2026-09-11"; // Freitag
    const grid = heatmapGrid(counts({ "2026-09-11": 4, "2026-09-07": 1 }), today);
    expect(grid.weeks).toHaveLength(HEATMAP_WEEKS);
    // Montag der Woche (7.9.) minus 52 Wochen
    expect(heatmapStart(today)).toBe("2025-09-08");
    const last = grid.weeks.at(-1)!;
    expect(last[0]).toEqual({ day: "2026-09-07", count: 1 });
    expect(last[4]).toEqual({ day: "2026-09-11", count: 4 });
    expect(last[5]).toBeNull();
    expect(grid.monthStarts.filter(Boolean).length).toBeGreaterThanOrEqual(11);
  });

  it("Stufen", () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 40].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("Serien", () => {
  it("heute noch nichts: die Serie bis gestern zählt", () => {
    const c = counts({ "2026-09-08": 1, "2026-09-09": 2, "2026-09-10": 1 });
    expect(streaks(c, "2026-09-11")).toEqual({ current: 3, longest: 3 });
  });

  it("längste Serie aus der Vergangenheit, Lücke bricht ab", () => {
    const c = counts({ "2026-08-01": 1, "2026-08-02": 1, "2026-08-03": 1, "2026-08-04": 1, "2026-09-10": 0, "2026-09-11": 2 });
    expect(streaks(c, "2026-09-11")).toEqual({ current: 1, longest: 4 });
    expect(streaks(counts({}), "2026-09-11")).toEqual({ current: 0, longest: 0 });
  });
});

describe("Erfolge", () => {
  it("Fortschritt gedeckelt, erreicht ab Ziel", () => {
    const list = achievements({ projects: 3, shipped: 0, tasksDone: 150, longestStreak: 8, repos: 1, live: 0, writing: 5, buried: 0 });
    const by = Object.fromEntries(list.map((a) => [a.key, a]));
    expect(by.firstProject.done).toBe(true);
    expect(by.ideas).toMatchObject({ value: 3, target: 10, done: false });
    expect(by.tasks100).toMatchObject({ value: 100, done: true });
    expect(by.streak7.done).toBe(true);
    expect(by.streak30.done).toBe(false);
  });
});
