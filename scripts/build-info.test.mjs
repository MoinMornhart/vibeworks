import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collect, webUrl } from "./build-info.mjs";

const pkgVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

describe("Build-Info", () => {
  it("Version aus package.json, Commit-Zahl nur als Update-Nummer", () => {
    // 71 Commits ergäben rechnerisch 0.7.1 – maßgeblich ist aber package.json
    const info = collect(".", {
      VIBEWORKS_SHA: "0123456789abcdef0123456789abcdef01234567",
      VIBEWORKS_COMMIT_COUNT: "71",
      VIBEWORKS_COMMIT_DATE: "2026-09-10T18:00:00+02:00",
      VIBEWORKS_REPO_URL: "https://github.com/MoinMornhart/vibeworks.git",
    });
    expect(info).toMatchObject({ version: pkgVersion, shortCommit: "0123456", count: 71, source: "env", repoUrl: "https://github.com/MoinMornhart/vibeworks" });
  });

  it("auch aus git: Version aus package.json", () => {
    const info = collect(".", {});
    expect(info.version).toBe(pkgVersion);
  });
});

describe("webUrl", () => {
  it("macht aus Remotes Web-Adressen ohne Zugangsdaten", () => {
    expect(webUrl("git@github.com:MoinMornhart/vibeworks.git")).toBe("https://github.com/MoinMornhart/vibeworks");
    expect(webUrl("https://token@github.com/a/b.git")).toBe("https://github.com/a/b");
    expect(webUrl("/lokaler/pfad")).toBeNull();
  });
});
