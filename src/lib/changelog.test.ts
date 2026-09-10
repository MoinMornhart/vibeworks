import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHANGELOG } from "./changelog";
// @ts-expect-error – reines ESM-Skript ohne Typen
import { nextVersion } from "../../scripts/bump-version.mjs";

describe("Versionen", () => {
  it("oberster Changelog-Eintrag entspricht package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });

  it("Changelog ist lückenlos im Zählwerk-Schema", () => {
    for (let i = 0; i < CHANGELOG.length - 1; i++) {
      expect(nextVersion(CHANGELOG[i + 1].version)).toBe(CHANGELOG[i].version);
    }
  });

  it("zählt mit Übertrag bei 9", () => {
    expect(nextVersion("0.0.1")).toBe("0.0.2");
    expect(nextVersion("0.0.9")).toBe("0.1.0");
    expect(nextVersion("0.1.9")).toBe("0.2.0");
    expect(nextVersion("0.9.9")).toBe("1.0.0");
    expect(nextVersion("1.2.3")).toBe("1.2.4");
  });
});
