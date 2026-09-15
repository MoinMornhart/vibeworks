import { describe, expect, it } from "vitest";
import { fingerprintSource, normalizeMessage, parseErrorReport, snippets, topFrame } from "./bugsLogic";

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
    expect(s.curl).toContain("curl -X POST https://vw.example/api/errors/in/abc_DEF-123456789012");
  });
  it("die Adresse kann nicht aus dem String ausbrechen", () => {
    expect(snippets('x";alert(1);"').browser).toContain('"x\\";alert(1);\\""');
  });
});
