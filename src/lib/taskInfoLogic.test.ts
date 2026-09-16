import { describe, expect, it } from "vitest";
import { commitsForIssue, shortDuration, taskIdOfCall } from "./taskInfoLogic";

const c = (title: string, body = "") => ({ sha: title, title, body, author: "a", date: "2026-09-16", url: null });
const unit = { s: "s", min: "min", h: "h", d: "T" };

describe("Info-Fenster einer Aufgabe", () => {
  it("findet Commits zum Issue – aber nicht #123 oder fremde Verweise", () => {
    const commits = [c("Fix Login (Fixes #12)"), c("Anderes #123"), c("Refs owner/repo#12"), c("Titel", "Teil von #12"), c("#12 am Anfang"), c("abc#12")];
    expect(commitsForIssue(commits, 12).map((x) => x.title)).toEqual(["Fix Login (Fixes #12)", "Titel", "#12 am Anfang"]);
    expect(commitsForIssue(commits, null)).toEqual([]);
    expect(commitsForIssue(commits, 12, 1)).toHaveLength(1);
  });

  it("zeigt Dauern kurz", () => {
    expect(shortDuration(45, unit)).toBe("45 s");
    expect(shortDuration(12 * 60 + 5, unit)).toBe("12 min");
    expect(shortDuration(65 * 60, unit)).toBe("1 h 05 min");
    expect(shortDuration(3 * 86400 + 4 * 3600, unit)).toBe("3 T 4 h");
    expect(shortDuration(-5, unit)).toBe("0 s");
  });

  it("ordnet MCP-Aufrufe ihrer Aufgabe zu", () => {
    expect(taskIdOfCall({ task: "abc123" }, null)).toBe("abc123");
    expect(taskIdOfCall({ project: "x" }, { task: { id: "neu1" } })).toBe("neu1");
    expect(taskIdOfCall({}, { tasks: [] })).toBeNull();
    expect(taskIdOfCall({ task: "x".repeat(80) }, null)).toBeNull();
  });
});
