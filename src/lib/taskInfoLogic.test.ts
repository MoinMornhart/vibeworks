import { describe, expect, it } from "vitest";
import { commitsForIssue, keyShortId, seenTaskIdsOfResult, shortDuration, taskIdOfCall } from "./taskInfoLogic";

describe("gesehene Aufgaben (#76)", () => {
  it("findet Aufgaben in Listen und verschachtelten Ergebnissen", () => {
    const result = { today: "2026-09-16", tasks: [{ id: "t1", title: "A", status: "TODO", project: { id: "p1", name: "P" } }, { id: "t2", title: "B", status: "DOING" }] };
    expect(seenTaskIdsOfResult(result)).toEqual(["t1", "t2"]);
    expect(seenTaskIdsOfResult({ created: [{ task: { id: "t3", title: "C", status: "TODO" } }] })).toEqual(["t3"]);
    expect(seenTaskIdsOfResult({ projects: [{ id: "p1", name: "x", status: "OPEN" }] })).toEqual([]);
    expect(seenTaskIdsOfResult("text")).toEqual([]);
    expect(seenTaskIdsOfResult({ tasks: Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, title: "x", status: "TODO" })) })).toHaveLength(100);
  });
  it("Schlüssel-Kennung ist kurz und fest", () => {
    expect(keyShortId("cmu41s8di0006e8hkkzgbzt8f")).toBe("GBZT8F");
  });
});

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
