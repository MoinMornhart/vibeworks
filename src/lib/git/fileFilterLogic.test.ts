import { describe, expect, it } from "vitest";
import { appendGitignore, matchGlob, normalizeFilter, prViolations, scanFiles, statusDescription } from "./fileFilterLogic";

describe("matchGlob (#92)", () => {
  it("Dateinamen überall", () => {
    expect(matchGlob("tools/setup.EXE", "*.exe")).toBe(true);
    expect(matchGlob(".env", ".env")).toBe(true);
    expect(matchGlob("app/.env", ".env")).toBe(true);
    expect(matchGlob(".env.example", ".env")).toBe(false);
  });
  it("Ordner überall bzw. ab der Wurzel", () => {
    expect(matchGlob("web/node_modules/x/index.js", "node_modules/")).toBe(true);
    expect(matchGlob("node_modules.txt", "node_modules/")).toBe(false);
    expect(matchGlob(".github/workflows/ci.yml", ".github/workflows/")).toBe(true);
    expect(matchGlob("docs/.github/workflows/ci.yml", ".github/workflows/")).toBe(false);
    expect(matchGlob("prisma/schema.prisma", "prisma/schema.prisma")).toBe(true);
  });
  it("** über mehrere Ebenen", () => {
    expect(matchGlob("src/a/b/debug.log", "src/**/*.log")).toBe(true);
    expect(matchGlob("src/debug.log", "src/**/*.log")).toBe(true);
    expect(matchGlob("lib/debug.log", "src/**/*.log")).toBe(false);
    expect(matchGlob("a/".repeat(40) + "x", "**/**/**/**/**/y")).toBe(false);
  });
});

describe("normalizeFilter", () => {
  it("nur sichere, eindeutige Regeln", () => {
    const f = normalizeFilter({
      rules: [
        { pattern: "*.exe", kind: "trash" },
        { pattern: "*.exe", kind: "trash" },
        { pattern: "../etc", kind: "trash" },
        { pattern: "$(rm)", kind: "trash" },
        { pattern: "package.json", kind: "protected" },
        { pattern: "x", kind: "egal" },
      ],
      allowed: [{ pr: 3, sha: "abcdef1" }, { pr: "x", sha: "zz" }],
      checked: { "3": "abcdef1:success", evil: "x" },
    });
    expect(f.rules).toEqual([
      { pattern: "*.exe", kind: "trash" },
      { pattern: "package.json", kind: "protected" },
    ]);
    expect(f.allowed).toEqual([{ pr: 3, sha: "abcdef1" }]);
    expect(f.checked).toEqual({ "3": "abcdef1:success" });
  });
});

describe("scanFiles", () => {
  it("findet Müll, Vorschläge und geschützte Dateien", () => {
    const s = scanFiles(["a.exe", "debug.log", "src/app.ts", "package.json", ".DS_Store"], {
      rules: [
        { pattern: "*.exe", kind: "trash" },
        { pattern: "package.json", kind: "protected" },
        { pattern: "prisma/schema.prisma", kind: "protected" },
      ],
    });
    expect(s.trash).toEqual([{ file: "a.exe", pattern: "*.exe" }]);
    expect(s.suggestions).toEqual([
      { file: "debug.log", pattern: "*.log" },
      { file: ".DS_Store", pattern: ".DS_Store" },
    ]);
    expect(s.protectedFiles).toEqual(["package.json"]);
    expect(s.missingProtected).toEqual(["prisma/schema.prisma"]);
  });
});

describe("prViolations", () => {
  const filter = { rules: [{ pattern: "*.json", kind: "protected" as const }, { pattern: "*.exe", kind: "trash" as const }] };
  it("erkennt Löschen, Umbenennen, Endungswechsel und Müll", () => {
    expect(
      prViolations(
        [
          { filename: "config.json", status: "removed" },
          { filename: "data/big.json", status: "renamed", previous_filename: "big.json" },
          { filename: "settings.yaml", status: "renamed", previous_filename: "settings.json" },
          { filename: "tool.exe", status: "added" },
          { filename: "src/a.ts", status: "modified" },
        ],
        filter,
      ).map((v) => v.kind),
    ).toEqual(["protectedRemoved", "protectedRenamed", "extensionChanged", "trashAdded"]);
  });
  it("Statustext kurz und mit Anzahl", () => {
    expect(statusDescription([], false)).toBe("Dateifilter: alles in Ordnung");
    expect(statusDescription([{ kind: "trashAdded", file: "x.exe" }, { kind: "protectedRemoved", file: "a.json" }], false)).toBe("Dateifilter: x.exe – fügt gefilterte Datei hinzu (+1)");
    expect(statusDescription([{ kind: "trashAdded", file: "x.exe" }], true)).toContain("erlaubt");
  });
});

describe("appendGitignore", () => {
  it("hängt nur Neues an", () => {
    expect(appendGitignore("node_modules/\n", ["node_modules/", "*.exe"])).toBe("node_modules/\n\n# Von VibeWorks (Dateifilter)\n*.exe\n");
    expect(appendGitignore("", ["*.exe"])).toBe("# Von VibeWorks (Dateifilter)\n*.exe\n");
    expect(appendGitignore("*.exe", ["*.exe"])).toBe("*.exe");
  });
});
