import { describe, expect, it } from "vitest";
import { baseVersion, countPackages, parseManifest, sortPackages, updateLevel, type DepPackage } from "./depsLogic";

describe("Abhängigkeiten", () => {
  it("liest dependencies und devDependencies, doppelte nur einmal", () => {
    const list = parseManifest({ dependencies: { next: "^15.1.0", react: "19.0.0" }, devDependencies: { typescript: "~5.6", react: "19.0.0" }, scripts: { dev: "x" } });
    expect(list).toEqual([
      { name: "next", range: "^15.1.0", dev: false },
      { name: "react", range: "19.0.0", dev: false },
      { name: "typescript", range: "~5.6", dev: true },
    ]);
    expect(parseManifest(null)).toEqual([]);
  });

  it("deutet Versionsbereiche", () => {
    expect(baseVersion("^15.1.0")).toBe("15.1.0");
    expect(baseVersion("~1.2")).toBe("1.2.0");
    expect(baseVersion(">=2.0.0 <3")).toBe("2.0.0");
    expect(baseVersion("1.x")).toBe("1.0.0");
    expect(baseVersion("workspace:*")).toBeNull();
    expect(baseVersion("github:user/repo")).toBeNull();
    expect(baseVersion("latest")).toBeNull();
  });

  it("stuft den Abstand ein", () => {
    expect(updateLevel("14.2.0", "15.0.1")).toBe("major");
    expect(updateLevel("15.1.0", "15.3.0")).toBe("minor");
    expect(updateLevel("15.1.0", "15.1.4")).toBe("patch");
    expect(updateLevel("15.1.0", "15.1.0")).toBe("current");
    expect(updateLevel("2.0.0-beta.1", "1.9.0")).toBe("current");
    expect(updateLevel(null, "1.0.0")).toBe("unknown");
  });

  it("Sicherheitswarnungen zuerst, dann nach Abstand", () => {
    const p = (name: string, level: DepPackage["level"], sev?: "high" | "low"): DepPackage => ({
      name, range: "", dev: false, current: null, latest: null, level,
      advisories: sev ? [{ title: "x", severity: sev, url: null }] : [],
    });
    const sorted = sortPackages([p("a", "current"), p("b", "patch"), p("c", "major"), p("d", "current", "low"), p("e", "minor", "high")]);
    expect(sorted.map((x) => x.name)).toEqual(["e", "d", "c", "b", "a"]);
    expect(countPackages(sorted)).toEqual({ total: 5, outdated: 3, major: 1, vulnerable: 2 });
  });
});
