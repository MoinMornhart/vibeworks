import { describe, expect, it } from "vitest";
import { checkSyntax, conflictCount, formatJson, parseConflicts, resolveAll, resolveConflict, sideOf } from "./conflictLogic";

const text = ["{", "<<<<<<< refs/vw/head", '  "port": 3000,', "||||||| base", '  "port": 80,', "=======", '  "port": 8080,', ">>>>>>> refs/vw/base", '  "name": "app"', "}"].join("\n");

describe("Konflikte zerlegen (#92)", () => {
  it("erkennt diff3-Konflikte mit Seiten", () => {
    const s = parseConflicts(text);
    expect(s.map((x) => x.kind)).toEqual(["text", "conflict", "text"]);
    expect(s[1]).toMatchObject({ ours: '  "port": 3000,', base: '  "port": 80,', theirs: '  "port": 8080,', oursLabel: "refs/vw/head", theirsLabel: "refs/vw/base" });
    expect(conflictCount(text)).toBe(1);
  });
  it("unvollständige Marker bleiben Text", () => {
    expect(conflictCount("<<<<<<< a\nx\n=======\ny")).toBe(0);
  });
  it("löst einzeln und alle", () => {
    expect(resolveConflict(text, 0, "ours")).toBe('{\n  "port": 3000,\n  "name": "app"\n}');
    expect(resolveConflict(text, 0, "theirs")).toContain('"port": 8080');
    expect(resolveAll(text, "both")).toBe('{\n  "port": 3000,\n  "port": 8080,\n  "name": "app"\n}');
    const two = `${text}\n<<<<<<< refs/vw/head\na\n=======\nb\n>>>>>>> refs/vw/base`;
    const first = resolveConflict(two, 0, "ours");
    expect(conflictCount(first)).toBe(1);
    expect(resolveConflict(first, 0, "theirs").endsWith("}\nb")).toBe(true);
  });
  it("Seiten benennen", () => {
    expect(sideOf("refs/vw/head")).toBe("pr");
    expect(sideOf("refs/vw/base")).toBe("base");
  });
});

describe("Syntax prüfen", () => {
  it("offene Marker zuerst", () => {
    expect(checkSyntax("a.json", text)).toMatchObject({ ok: false, problem: "markers", line: 2 });
  });
  it("JSON mit Zeile", () => {
    const bad = checkSyntax("config.json", '{\n  "a": 1,\n  "b": 2,\n}');
    expect(bad).toMatchObject({ ok: false, problem: "json" });
    expect(bad.line).toBeGreaterThanOrEqual(3);
    expect(checkSyntax("config.json", resolveConflict(text, 0, "ours")).ok).toBe(true);
  });
  it("Klammern und HTML-Tags", () => {
    expect(checkSyntax("a.ts", "function x() {\n  return [1, 2;\n}")).toMatchObject({ ok: false, problem: "brackets", line: 2 });
    expect(checkSyntax("a.ts", 'const s = "}";\n// ) Kommentar\nfoo({ a: [1] });').ok).toBe(true);
    expect(checkSyntax("index.html", "<div><p>Hi</div>")).toMatchObject({ ok: false, problem: "tags" });
    expect(checkSyntax("index.html", "<!doctype html><html><body><img src=x><br/><script>if (a<b) {}</script></body></html>").ok).toBe(true);
    expect(checkSyntax("notes.md", "egal { ").ok).toBe(true);
  });
  it("JSON formatieren", () => {
    expect(formatJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}\n');
    expect(formatJson("{kaputt")).toBeNull();
  });
});
