import { describe, expect, it } from "vitest";
import type { DepPackage, DepsReport } from "./depsLogic";
import { depsTaskAction, namesIn, planDepsTasks, shortList } from "./depsTasksLogic";

const pkg = (name: string, level: DepPackage["level"], advisories: DepPackage["advisories"] = []): DepPackage => ({ name, range: "^1.0.0", dev: false, current: "1.0.0", latest: "2.0.0", level, advisories });
const report = (packages: DepPackage[], extra: Partial<DepsReport> = {}): DepsReport => ({ checkedAt: "2026-09-15T08:00:00Z", manifest: true, packages, counts: { total: 0, outdated: 0, major: 0, vulnerable: 0 }, error: null, ...extra });
const label = { severity: (s: string) => s, level: (l: string) => l };

describe("planDepsTasks", () => {
  it("trennt Sicherheitslücken von Updates, Major zuerst", () => {
    const plans = planDepsTasks(
      report([pkg("zod", "patch"), pkg("next", "major"), pkg("lodash", "minor", [{ title: "Prototype Pollution", severity: "high", url: "https://github.com/advisories/GHSA-1" }]), pkg("react", "current")]),
      label,
    )!;
    expect(plans.map((p) => [p.key, p.names])).toEqual([
      ["deps:vuln", ["lodash"]],
      ["deps:update", ["next", "zod"]],
    ]);
    expect(plans[0].lines[0]).toBe("- `lodash` ^1.0.0 → 2.0.0: [high: Prototype Pollution](https://github.com/advisories/GHSA-1)");
    expect(plans[1].lines[0]).toBe("- `next` ^1.0.0 → 2.0.0 (major)");
    expect(namesIn(plans[1].lines.join("\n"))).toEqual(["next", "zod"]);
  });
  it("ohne package.json oder bei Fehler: nichts anfassen", () => {
    expect(planDepsTasks(report([], { manifest: false }), label)).toBeNull();
    expect(planDepsTasks(report([pkg("a", "major")], { error: "kaputt" }), label)).toBeNull();
  });
});

describe("depsTaskAction", () => {
  const open = (description: string) => ({ status: "TODO", description });
  const done = (description: string) => ({ status: "DONE", description });
  it("anlegen, aktualisieren, erledigen", () => {
    expect(depsTaskAction(null, { names: ["a"], description: "x" })).toBe("create");
    expect(depsTaskAction(null, { names: [], description: "x" })).toBe("none");
    expect(depsTaskAction(open("x"), { names: ["a"], description: "x" })).toBe("none");
    expect(depsTaskAction(open("x"), { names: ["a", "b"], description: "y" })).toBe("update");
    expect(depsTaskAction(open("x"), { names: [], description: "" })).toBe("close");
  });
  it("erledigt bleibt erledigt – außer es kommt ein neues Paket dazu", () => {
    const before = "Liste:\n\n- `a` ^1 → 2\n- `b` ^1 → 2";
    expect(depsTaskAction(done(before), { names: ["a"], description: "neu" })).toBe("none");
    expect(depsTaskAction(done(before), { names: [], description: "" })).toBe("none");
    expect(depsTaskAction(done(before), { names: ["a", "c"], description: "neu" })).toBe("reopen");
  });
  it("kurze Liste für den Titel", () => {
    expect(shortList(["a", "b"])).toBe("a, b");
    expect(shortList(["a", "b", "c", "d"])).toBe("a, b, c …");
  });
});
