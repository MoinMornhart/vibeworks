import { describe, expect, it } from "vitest";
import { checkItems, isCheckTaskMode, planCheckTasks } from "./checkTasksLogic";
import type { CheckReport } from "./repoCheckLogic";

const report = {
  version: 1,
  commit: "abc",
  finishedAt: "",
  tools: { gitleaks: true, osv: true, semgrep: true, todos: true },
  secrets: [{ file: ".env", line: 3, rule: "generic-api-key", description: "Generic API Key", commit: "abc" }],
  vulnerabilities: [
    { package: "next", version: "15.0.0", ecosystem: "npm", id: "GHSA-1", summary: "SSRF", severity: "8.1", source: "package-lock.json" },
    { package: "next", version: "15.0.0", ecosystem: "npm", id: "GHSA-1", summary: "SSRF", severity: "8.1", source: "other/package-lock.json" },
  ],
  findings: [{ file: ".github/workflows/desktop.yml", line: 28, rule: "mutable-action-tag", severity: "WARNING", message: "Pin `actions` to a SHA" }],
  todos: [],
  counts: { secrets: 1, vulnerabilities: 2, findings: 1, todos: 0 },
} as unknown as CheckReport;

describe("Aufgaben aus dem Repo-Check", () => {
  it("kennt nur die drei Stufen", () => {
    expect(isCheckTaskMode("urgent")).toBe(true);
    expect(isCheckTaskMode("sometimes")).toBe(false);
  });

  it("aus: keine Aufgaben", () => {
    expect(planCheckTasks(report, "off")).toEqual([]);
  });

  it("dringend: Geheimnisse und Lücken, doppelte Lücken nur einmal", () => {
    const plans = planCheckTasks(report, "urgent");
    expect(plans.map((p) => p.key)).toEqual(["check:secrets", "check:vulns"]);
    expect(plans[1].names).toEqual(["next@15.0.0 GHSA-1"]);
    expect(plans[0].lines[0]).toBe("- `.env:3 generic-api-key` – Generic API Key");
  });

  it("alles: auch Befunde – Backticks werden entschärft", () => {
    const plans = planCheckTasks(report, "all");
    expect(plans.map((p) => p.key)).toContain("check:findings");
    expect(plans[2].lines[0]).toContain("Pin 'actions' to a SHA");
  });

  it("nicht gelaufene Werkzeuge fehlen im Plan", () => {
    const partial = { ...report, tools: { ...report.tools, osv: false } } as CheckReport;
    expect(planCheckTasks(partial, "urgent").map((p) => p.kind)).toEqual(["secrets"]);
  });

  it("liefert die Werte für Erklärung und Auftrag", () => {
    expect(checkItems(report, "findings")[0].vars).toEqual({ rule: "mutable-action-tag", file: ".github/workflows/desktop.yml:28" });
  });
});
