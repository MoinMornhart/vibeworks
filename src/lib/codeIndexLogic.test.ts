import { describe, expect, it } from "vitest";
import { fileSummary, filterFiles, isCodeFile, matchesWildcard, parseGrep } from "./codeIndexLogic";

const files = ["src/lib/foo.ts", "src/lib/bar.ts", "src/app/page.tsx", "README.md", "node_modules/x/index.js", "public/logo.png", "dist/main.js"];

describe("Code-Index", () => {
  it("lässt Abhängigkeiten, Gebautes und Bilder weg", () => {
    expect(isCodeFile("src/lib/foo.ts")).toBe(true);
    expect(isCodeFile("node_modules/x/index.js")).toBe(false);
    expect(isCodeFile("public/logo.png")).toBe(false);
    expect(isCodeFile("dist/main.js")).toBe(false);
  });

  it("zerlegt die Treffer von git grep – mit und ohne Zweig davor", () => {
    const out = ["refs/heads/main:src/lib/foo.ts:42:  export function foo() {", "src/app/page.tsx:7:<Foo />", "node_modules/x/index.js:1:foo", "kaputt", ""].join("\n");
    expect(parseGrep(out)).toEqual([
      { file: "src/lib/foo.ts", line: 42, text: "export function foo() {" },
      { file: "src/app/page.tsx", line: 7, text: "<Foo />" },
    ]);
    expect(parseGrep(out, 1)).toHaveLength(1);
  });

  it("fasst ein Repository zusammen", () => {
    const s = fileSummary(files);
    expect(s).toMatchObject({ files: 4, skipped: 3 });
    expect(s.extensions[0]).toEqual({ name: "ts", files: 2 });
    expect(s.folders.map((f) => f.name)).toContain("src");
  });

  it("filtert Dateien per Teilstring und Platzhalter", () => {
    expect(filterFiles(files, "foo")).toEqual(["src/lib/foo.ts"]);
    expect(filterFiles(files, "src/lib/*.ts")).toEqual(["src/lib/foo.ts", "src/lib/bar.ts"]);
    expect(filterFiles(files, null)).toHaveLength(4);
    expect(filterFiles(files, "  ")).toHaveLength(4);
  });

  it("Platzhalter ohne Regex – gleiche Treffer, keine Festrechner (#61)", () => {
    expect(matchesWildcard("src/lib/foo.ts", "src/*.ts")).toBe(true);
    expect(matchesWildcard("src/lib/foo.ts", "*foo*")).toBe(true);
    expect(matchesWildcard("src/lib/foo.ts", "src/*/bar.ts")).toBe(false);
    expect(matchesWildcard("a.ts", "a*a.ts")).toBe(false); // Anfang und Ende dürfen sich nicht überlappen
    expect(matchesWildcard("aba", "a*b*a")).toBe(true);
    expect(matchesWildcard("ab", "a*b*a")).toBe(false);
    expect(matchesWildcard("x", "*")).toBe(true);
    expect(filterFiles(["src/[x]/(y).ts"], "src/[x]/*.ts")).toEqual(["src/[x]/(y).ts"]); // Sonderzeichen wörtlich
    const evil = `${"a*".repeat(99)}b`;
    const started = Date.now();
    expect(matchesWildcard("a".repeat(5000), evil)).toBe(false);
    expect(Date.now() - started).toBeLessThan(200);
  });
});
