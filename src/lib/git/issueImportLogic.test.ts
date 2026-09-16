import { describe, expect, it } from "vitest";
import { fromVibeWorks, importDecision, normalizeGitPeople, roleOf, taskFromIssue, trustedAuthor } from "./issueImportLogic";

describe("Personen und Rollen (#69)", () => {
  it("räumt die Liste auf", () => {
    expect(
      normalizeGitPeople([
        { login: "@JoniMoni09", role: "worker" },
        { login: "jonimoni09", role: "bughunter" },
        { login: "böse name", role: "worker" },
        { login: "anna", role: "chef" },
        { login: "bert", role: "bughunter" },
      ]),
    ).toEqual([
      { login: "JoniMoni09", role: "worker" },
      { login: "bert", role: "bughunter" },
    ]);
    expect(normalizeGitPeople("x")).toEqual([]);
  });
  it("Rolle unabhängig von Groß-/Kleinschreibung", () => {
    expect(roleOf([{ login: "Bert", role: "bughunter" }], "bert")).toBe("bughunter");
    expect(roleOf([], "bert")).toBeNull();
  });
});

describe("Vertrauen und Entscheidung", () => {
  it("Schreibrecht oder Rolle", () => {
    expect(trustedAuthor("write", null)).toBe(true);
    expect(trustedAuthor("read", "worker")).toBe(true);
    expect(trustedAuthor("read", null)).toBe(false);
    expect(trustedAuthor(null, null)).toBe(false);
  });
  it("Modus entscheidet über Fremde", () => {
    expect(importDecision("off", true)).toBe("skip");
    expect(importDecision("trusted", true)).toBe("import");
    expect(importDecision("trusted", false)).toBe("skip");
    expect(importDecision("all", false)).toBe("locked");
  });
  it("erkennt eigene Issues an der Marke", () => {
    expect(fromVibeWorks("x\n<!-- vibeworks:task:abc -->")).toBe(true);
    expect(fromVibeWorks("Bug im Login")).toBe(false);
    expect(fromVibeWorks(null)).toBe(false);
  });
});

describe("Aufgabe aus Issue", () => {
  const issue = { number: 12, url: "https://github.com/o/r/issues/12", title: "  Login kaputt ", body: "Schritte …", author: "bert", labels: ["in Arbeit", "🤖 Claude", "ui"] };
  it("Bughunter: Label bug und hohe Priorität, Quelle im Text", () => {
    const t = taskFromIssue(issue, "bughunter", false);
    expect(t).toMatchObject({ title: "Login kaputt", labels: ["ui", "bug"], priority: 3, aiLocked: false, createdByName: "@bert", issueNumber: 12 });
    expect(t.description).toContain("Aus GitHub übernommen: https://github.com/o/r/issues/12 – von @bert (Bughunter)");
    expect(t.description).toContain("Schritte …");
  });
  it("Fremde: gesperrt und markiert", () => {
    const t = taskFromIssue({ ...issue, title: "", body: null }, null, true);
    expect(t).toMatchObject({ title: "Issue #12", labels: ["ui", "extern"], priority: 2, aiLocked: true });
  });
});
