import { describe, expect, it } from "vitest";
import { collect, versionFromCount, webUrl } from "./build-info.mjs";
import { nextVersion } from "./bump-version.mjs";

describe("Version aus der Zahl der Commits", () => {
  it("jeder Commit eine Stufe, Übertrag bei 9", () => {
    expect(versionFromCount(1)).toBe("0.0.1");
    expect(versionFromCount(9)).toBe("0.0.9");
    expect(versionFromCount(10)).toBe("0.1.0");
    expect(versionFromCount(16)).toBe("0.1.6");
    expect(versionFromCount(99)).toBe("0.9.9");
    expect(versionFromCount(100)).toBe("1.0.0");
    expect(versionFromCount(1234)).toBe("12.3.4");
  });

  it("stimmt mit dem Zählwerk von version:bump überein", () => {
    for (let n = 1; n < 1200; n++) expect(nextVersion(versionFromCount(n))).toBe(versionFromCount(n + 1));
  });

  it("nimmt auf dem Server die Angaben des update-Befehls", () => {
    const info = collect(".", {
      VIBEWORKS_SHA: "0123456789abcdef0123456789abcdef01234567",
      VIBEWORKS_COMMIT_COUNT: "17",
      VIBEWORKS_COMMIT_DATE: "2026-09-10T18:00:00+02:00",
      VIBEWORKS_REPO_URL: "https://github.com/MoinMornhart/vibeworks.git",
    });
    expect(info).toMatchObject({ version: "0.1.7", shortCommit: "0123456", count: 17, source: "env", repoUrl: "https://github.com/MoinMornhart/vibeworks" });
  });
});

describe("webUrl", () => {
  it("macht aus Remotes Web-Adressen ohne Zugangsdaten", () => {
    expect(webUrl("git@github.com:MoinMornhart/vibeworks.git")).toBe("https://github.com/MoinMornhart/vibeworks");
    expect(webUrl("https://token@github.com/a/b.git")).toBe("https://github.com/a/b");
    expect(webUrl("/lokaler/pfad")).toBeNull();
  });
});
