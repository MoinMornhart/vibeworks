import { describe, expect, it } from "vitest";
import { applyStructure, EMPTY_STRUCTURE, missingPaths, planStructureTask, readStructure, structureMarkdown, suggestAreas, undocumentedAreas } from "./projectStructureLogic";

const now = new Date("2026-09-16T20:00:00Z");
const api = { area: "API", path: "src/app/api/", purpose: "REST-Endpunkte", how: "route() prüft Herkunft" };
const ui = { area: "Oberfläche", path: "src/components/", purpose: "React-Komponenten", how: "" };

describe("Projektaufbau (#101)", () => {
  it("ersetzt, ergänzt und entfernt Zeilen", () => {
    const a = applyStructure(EMPTY_STRUCTURE, { overview: "Next.js-App", rows: [api] }, "Claude", now);
    expect(a).toMatchObject({ overview: "Next.js-App", rows: [api], updatedBy: "Claude", updatedAt: now.toISOString() });
    const b = applyStructure(a, { rows: [{ ...api, purpose: "Alle Endpunkte" }, ui], merge: true }, "anna", now);
    expect(b.rows.map((r) => r.purpose)).toEqual(["Alle Endpunkte", "React-Komponenten"]);
    expect(b.overview).toBe("Next.js-App");
    const c = applyStructure(b, { remove: ["SRC/APP/API/"] }, "anna", now);
    expect(c.rows).toEqual([ui]);
    expect(applyStructure(c, { rows: [] }, "anna", now).rows).toEqual([]);
  });

  it("liest kaputte Daten tolerant", () => {
    expect(readStructure(null)).toEqual(EMPTY_STRUCTURE);
    expect(readStructure({ overview: 3, rows: [api, { area: "" }, "x"] }).rows).toEqual([api]);
  });

  it("schlägt Bereiche aus echten Ordnern vor", () => {
    const files = ["README.md", "src/app/page.tsx", "src/app/api/a.ts", "src/lib/a.ts", "src/lib/b.ts", "src/lib/c.ts", ".vscode/x.json", ".github/workflows/ci.yml", "prisma/schema.prisma"];
    expect(suggestAreas(files)).toEqual([
      { path: ".github/", files: 1 },
      { path: "prisma/", files: 1 },
      { path: "src/", files: 5 },
      { path: "src/lib/", files: 3 },
    ]);
  });

  it("findet Pfade, die es nicht gibt", () => {
    const files = ["src/app/api/x.ts", "package.json"];
    expect(missingPaths([api, ui, { area: "Paket", path: "package.json", purpose: "p", how: "" }, { area: "Muster", path: "src/**/*.ts", purpose: "p", how: "" }], files)).toEqual([
      "src/components/",
    ]);
  });

  it("baut eine Markdown-Tabelle und maskiert Trennzeichen", () => {
    const md = structureMarkdown({ ...EMPTY_STRUCTURE, rows: [{ ...api, how: "a | b\nc" }] }, { area: "Bereich", path: "Pfad", purpose: "Zweck", how: "So geht's" });
    expect(md).toContain("| Bereich | Pfad | Zweck | So geht's |");
    expect(md).toContain("| API | `src/app/api/` | REST-Endpunkte | a \\| b c |");
    expect(structureMarkdown(EMPTY_STRUCTURE, { area: "", path: "", purpose: "", how: "" })).toBe("");
  });

  it("findet undokumentierte Ordner der obersten Ebene (#82)", () => {
    const files = ["src/app/api/x.ts", "src/lib/a.ts", "scripts/a.sh", "scripts/b.sh", "scripts/c.sh", "docs/a.md", "tools/x.ts", "tools/y.ts", "tools/z.ts"];
    const rows = [api, { area: "Doku", path: "./docs", purpose: "p", how: "" }, { area: "Werkzeuge", path: "tools/", purpose: "p", how: "" }];
    // src/ ist über src/app/api/ abgedeckt, docs/ hat zu wenige Dateien, tools/ steht drin
    expect(undocumentedAreas(rows, files)).toEqual(["scripts/"]);
  });

  it("plant die Wächter-Aufgabe nur mit Tabelle", () => {
    const label = { missing: "fehlt", undocumented: "nicht beschrieben" };
    const files = ["src/app/api/x.ts", "lib/a.ts", "lib/b.ts", "lib/c.ts"];
    expect(planStructureTask(EMPTY_STRUCTURE, files, label)).toBeNull();
    const plan = planStructureTask({ ...EMPTY_STRUCTURE, rows: [api, ui] }, files, label);
    expect(plan).toEqual({ names: ["src/components/", "lib/"], lines: ["- `src/components/` – fehlt", "- `lib/` – nicht beschrieben"] });
    expect(planStructureTask({ ...EMPTY_STRUCTURE, rows: [api, { ...ui, path: "lib/" }] }, files, label)?.names).toEqual([]);
  });
});
