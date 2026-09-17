import { describe, expect, it } from "vitest";
import { isEmptyReport, provenSteps, weeklyReportText, type WeeklyReportData } from "./weeklyReportLogic";

const t = (key: string, vars: Record<string, string | number> = {}) => `${key}${Object.keys(vars).length ? JSON.stringify(vars) : ""}`;
const empty: WeeklyReportData = { done: [], doneTotal: 0, runs: [], errors: [], sleeping: [] };

describe("Wochenbericht (#82)", () => {
  it("erkennt eine leere Woche", () => {
    expect(isEmptyReport(empty)).toBe(true);
    expect(isEmptyReport({ ...empty, sleeping: [{ project: "A", days: 40 }] })).toBe(false);
  });

  it("baut Abschnitte und kürzt lange Listen", () => {
    const done = Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, project: "P" }));
    const text = weeklyReportText(
      {
        done,
        doneTotal: 9,
        runs: [{ title: "Feature umsetzen", project: "P", steps: 7, proven: 6 }],
        errors: [
          { project: "P", count: 2 },
          { project: "Q", count: 1 },
        ],
        sleeping: [{ project: "Alt", days: 45 }],
      },
      t,
    );
    const sections = text.split("\n\n");
    expect(sections).toHaveLength(4);
    expect(sections[0].split("\n")).toEqual(['done{"n":9}', "• T0 (P)", "• T1 (P)", "• T2 (P)", "• T3 (P)", "• T4 (P)", 'more{"n":4}']);
    expect(sections[1]).toBe('runs{"n":1}\n• Feature umsetzen (P) – proven{"proven":6,"steps":7}');
    expect(sections[2]).toBe('errors{"n":3}\n• P: 2\n• Q: 1');
    expect(sections[3]).toBe('sleeping{"n":1}\n• Alt – days{"n":45}');
  });

  it("zählt nur erledigte Schritte mit Notiz als belegt", () => {
    expect(provenSteps(null)).toBe(0);
    expect(provenSteps([{ status: "done", note: "Tests grün" }, { status: "done", note: " " }, { status: "skipped", note: "x" }, null])).toBe(1);
  });
});
