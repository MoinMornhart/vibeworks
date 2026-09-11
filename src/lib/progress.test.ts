import { describe, expect, it } from "vitest";
import { analyzeProgress, progressInput, type ProgressInput } from "./progress";

const base = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  status: "IN_PROGRESS",
  tasks: { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 0 },
  repo: null,
  planning: { description: 0, summary: false, notes: 0 },
  ...over,
});

describe("Fortschritts-Analyse", () => {
  it("Fertig ist immer 100 %", () => {
    expect(analyzeProgress(base({ status: "DONE" })).progress).toBe(100);
  });

  it("ohne Signale 0 %, nur Planung höchstens 10 %", () => {
    expect(analyzeProgress(base()).progress).toBe(0);
    const planned = analyzeProgress(base({ planning: { description: 800, summary: true, notes: 5 } }));
    expect(planned.progress).toBe(10);
  });

  it("nur Aufgaben: der Anteil trägt die ganze Arbeit", () => {
    const a = analyzeProgress(base({ tasks: { TODO: 2, DOING: 0, BLOCKED: 0, DONE: 2 } }));
    // 85 Punkte Arbeit × 50 % erledigt ≈ 43
    expect(a.progress).toBe(43);
    expect(a.parts.find((p) => p.key === "tasks")?.points).toBe(43);
    expect(a.parts.find((p) => p.key === "development")?.available).toBe(false);
  });

  it("in Arbeit zählt halb, blockiert ein Viertel", () => {
    const a = analyzeProgress(base({ tasks: { TODO: 0, DOING: 2, BLOCKED: 2, DONE: 0 } }));
    expect(a.parts[0].score).toBeCloseTo(0.375);
  });

  it("Aufgaben und Repository teilen sich die Arbeit 70 : 30", () => {
    const a = analyzeProgress(base({ tasks: { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 4 }, repo: { commits: 40, ci: "success" } }));
    expect(a.progress).toBe(85);
    const red = analyzeProgress(base({ tasks: { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 4 }, repo: { commits: 40, ci: "failure" } }));
    expect(red.progress).toBeLessThan(a.progress);
  });

  it("der Status setzt die Obergrenze", () => {
    const full = { tasks: { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 10 }, repo: { commits: 100, ci: "success" }, planning: { description: 900, summary: true, notes: 3 } };
    // Alles erledigt: 95 % – mehr erst mit „Fertig“
    expect(analyzeProgress(base({ ...full })).progress).toBe(95);
    const idea = analyzeProgress(base({ ...full, status: "IDEA" }));
    expect(idea.progress).toBe(10);
    expect(idea.cappedAt).toBe(10);
    expect(idea.parts.find((p) => p.key === "tasks")?.points).toBeGreaterThan(10);
    expect(analyzeProgress(base({ ...full, status: "PLANNING" })).cappedAt).toBe(25);
    expect(analyzeProgress(base({ ...full, status: "ARCHIVED" })).progress).toBe(100);
  });

  it("baut die Eingabe aus Datenbank-Werten", () => {
    const input = progressInput({
      status: "OPEN",
      summary: " kurz ",
      description: "x".repeat(10),
      notes: 2,
      tasks: { DONE: 1 },
      repoUrl: "https://github.com/a/b",
      repoCache: { commits: [{}, {}, {}], ci: { state: "success" } },
    });
    expect(input).toEqual({
      status: "OPEN",
      tasks: { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 1 },
      repo: { commits: 3, ci: "success" },
      planning: { description: 10, summary: true, notes: 2 },
    });
    expect(progressInput({ status: "OPEN", summary: null, description: null, notes: 0, tasks: {}, repoUrl: null, repoCache: null }).repo).toBeNull();
  });
});
