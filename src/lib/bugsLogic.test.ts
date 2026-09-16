import { describe, expect, it } from "vitest";
import { fingerprintSource, MAX_BATCH, normalizeMessage, parseErrorBatch, parseErrorReport, parseLogLines, snippets, topFrame } from "./bugsLogic";

describe("parseErrorReport", () => {
  it("liest die üblichen Felder und kappt sie", () => {
    const r = parseErrorReport({ message: "x".repeat(5000), name: "TypeError", stack: "at a", url: "https://app.example/seite", version: "1.2.3", env: "production" });
    expect(r?.message).toHaveLength(1000);
    expect(r).toMatchObject({ type: "TypeError", stack: "at a", url: "https://app.example/seite", release: "1.2.3", environment: "production" });
  });
  it("ohne Nachricht nichts, fremde Werte werden verworfen", () => {
    expect(parseErrorReport({ type: "X" })).toBeNull();
    expect(parseErrorReport(null)).toBeNull();
    expect(parseErrorReport(["a"])).toBeNull();
    expect(parseErrorReport({ message: "a", url: "javascript:alert(1)", stack: 5 })).toMatchObject({ url: null, stack: null });
  });
});

describe("Absturzberichte (#75)", () => {
  it("versteht verschachtelte Fehler, deutsche Felder und Details", () => {
    expect(parseErrorReport({ error: { message: "kaputt", name: "TypeError", stack: "at x" } })).toMatchObject({ message: "kaputt", type: "TypeError", stack: "at x" });
    const r = parseErrorReport({ nachricht: "Renderer weg", typ: "CRASH", daten: { grund: "crashed", code: -2147483645 } });
    expect(r).toMatchObject({ message: "Renderer weg", type: "CRASH" });
    expect(r?.stack).toBe('Details: {"grund":"crashed","code":-2147483645}');
  });

  it("liest Log-Zeilen, nur Fehler, jede Zeile einmal", () => {
    const log = [
      '2026-09-15T18:04:38.818Z [CRASH] Renderer weg {"grund":"crashed","code":-2147483645}',
      '2026-09-15T18:04:38.902Z [CRASH] Renderer weg {"grund":"crashed","code":-2147483645}',
      "2026-09-15T18:04:39.163Z [START] Julia startet",
      "2026-09-16T10:57:28.940Z [FATAL] GPU-Absturz trotz Software-Rendering – Start abgesichert abgebrochen.",
      "kein Log",
    ].join("\r\n");
    const lines = parseLogLines(log);
    expect(lines.map((l) => [l.type, l.message])).toEqual([
      ["CRASH", "Renderer weg"],
      ["FATAL", "GPU-Absturz trotz Software-Rendering – Start abgesichert abgebrochen."],
    ]);
    expect(lines[0].stack).toContain('"grund":"crashed"');
  });

  it("nimmt Einzelberichte, Listen und Log-Text an", () => {
    expect(parseErrorBatch('{"message":"a"}')).toMatchObject({ single: true, reports: [{ message: "a" }] });
    expect(parseErrorBatch('[{"message":"a"},{"x":1},{"msg":"b"}]')).toMatchObject({ single: false, skipped: 1, reports: [{ message: "a" }, { message: "b" }] });
    expect(parseErrorBatch('{"reports":[{"message":"a"}]}')?.reports).toHaveLength(1);
    expect(parseErrorBatch("t [ERROR] weg")?.reports[0]).toMatchObject({ type: "ERROR", message: "weg" });
    expect(parseErrorBatch("kein json")).toBeNull();
    expect(parseErrorBatch('{"type":"X"}')).toBeNull();
    const many = JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ message: `m${i}` })));
    expect(parseErrorBatch(many)?.reports).toHaveLength(MAX_BATCH);
  });
});

describe("Fingerabdruck", () => {
  it("IDs und Zahlen machen keinen neuen Fehler", () => {
    expect(normalizeMessage("User 123 not found")).toBe(normalizeMessage("User 98 not found"));
    expect(normalizeMessage("Order 3f2a1b9c-1234-4abc-9def-001122334455 failed")).toBe("Order <id> failed");
  });
  it("Stack: Zeile, Spalte und Build-Hash fallen weg", () => {
    const chrome = "TypeError: x is undefined\n    at render (https://app.example/assets/index-3f2a1b9c.js:12:345)\n    at main";
    const next = "TypeError: x is undefined\n    at render (https://app.example/assets/index-a1b2c3d4.js:99:1)";
    expect(topFrame(chrome)).toBe(topFrame(next));
    expect(topFrame("render@https://app.example/app.js:3:4")).toBe("render@https://app.example/app.js");
    expect(topFrame(null)).toBe("");
  });
  it("gleiche Art, gleiche Stelle → gleicher Fingerabdruck; andere Stelle → anderer", () => {
    const a = fingerprintSource({ type: "TypeError", message: "Cannot read 'id' of undefined (item 4)", stack: "at load (app.js:1:2)" });
    const b = fingerprintSource({ type: "TypeError", message: "Cannot read 'id' of undefined (item 17)", stack: "at load (app.js:8:9)" });
    const c = fingerprintSource({ type: "TypeError", message: "Cannot read 'id' of undefined (item 4)", stack: "at save (app.js:1:2)" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("Schnipsel", () => {
  const s = snippets("https://vw.example/api/errors/in/abc_DEF-123456789012");
  it("enthalten die Adresse und sind gültiges JavaScript", () => {
    expect(s.browser).toContain('"https://vw.example/api/errors/in/abc_DEF-123456789012"');
    expect(() => new Function(s.browser.replace(/<\/?script>/g, ""))).not.toThrow();
    expect(() => new Function(s.node)).not.toThrow();
    expect(() => new Function(s.electron)).not.toThrow();
    expect(s.electron).toContain("child-process-gone");
    expect(s.curl).toContain("curl -X POST https://vw.example/api/errors/in/abc_DEF-123456789012");
  });
  it("die Adresse kann nicht aus dem String ausbrechen", () => {
    expect(snippets('x";alert(1);"').browser).toContain('"x\\";alert(1);\\""');
  });
});
