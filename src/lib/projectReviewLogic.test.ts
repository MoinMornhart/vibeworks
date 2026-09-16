import { describe, expect, it } from "vitest";
import { FINDING_HINTS, reviewProject, type ProjectFacts } from "./projectReviewLogic";

const NOW = Date.parse("2026-09-16T12:00:00Z");
const day = (n: number) => new Date(NOW - n * 86_400_000);
const base: ProjectFacts = { description: "Eine ausführliche Beschreibung des Projekts mit Ziel und Stack.", summary: null, notes: 2, repoFiles: ["README.md", "CLAUDE.md", "src/a.ts"], hasRepo: true, syncError: null, ciState: "success", progress: 50, tasks: [] };

describe("Projekt-Prüfung (#100)", () => {
  it("gut gepflegt: keine Befunde", () => {
    const r = reviewProject({ ...base, tasks: [{ status: "DONE", dueDate: null, updatedAt: day(1), assignee: null }, { status: "TODO", dueDate: null, updatedAt: day(1), assignee: null }] }, NOW);
    expect(r).toMatchObject({ findings: [], score: 100, done: 1, open: { todo: 1, doing: 0, blocked: 0, overdue: 0, stale: 0 } });
  });
  it("findet fehlende Doku", () => {
    const r = reviewProject({ ...base, description: null, notes: 0, repoFiles: ["src/a.ts"] }, NOW);
    expect(r.findings).toEqual(["noDescription", "noNotes", "noReadme", "noClaudeMd"]);
    expect(r.score).toBe(40);
    expect(reviewProject({ ...base, description: "Kurz" }, NOW).findings).toEqual(["shortDescription"]);
    expect(reviewProject({ ...base, repoFiles: ["docs/AGENTS.md", "readme.rst"] }, NOW).findings).toEqual([]);
  });
  it("ohne Code-Kopie keine Behauptungen über Dateien", () => {
    expect(reviewProject({ ...base, repoFiles: null }, NOW).findings).toEqual([]);
  });
  it("findet offene Baustellen", () => {
    const r = reviewProject(
      {
        ...base,
        syncError: "x",
        ciState: "failure",
        progress: 90,
        tasks: [
          { status: "TODO", dueDate: day(2), updatedAt: day(20), assignee: null },
          { status: "DOING", dueDate: null, updatedAt: day(1), assignee: null },
          { status: "BLOCKED", dueDate: null, updatedAt: day(1), assignee: "a" },
        ],
      },
      NOW,
    );
    expect(r.findings).toEqual(["syncError", "ciFailing", "overdueTasks", "blockedTasks", "staleTasks", "doingWithoutAssignee", "progressMismatch"]);
    expect(r.open).toEqual({ todo: 1, doing: 1, blocked: 1, overdue: 1, stale: 1 });
  });
  it("jeder Befund hat einen englischen Hinweis", () => {
    for (const hint of Object.values(FINDING_HINTS)) expect(hint).not.toMatch(/[äöüß]/);
  });
});
