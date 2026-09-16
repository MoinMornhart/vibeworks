import { isAiLocked } from "./aiLock";
import { describe, expect, it } from "vitest";
import { baseOf, boardColumns, columnKeyOf, columnNameOf, DEFAULT_BOARD, hidesEverything, nextExtraKey, normalizeBoard, resolveColumnInput } from "./boardConfig";

describe("Brett-Einstellungen", () => {
  it("nichts oder Unsinn ergibt den Standard", () => {
    expect(normalizeBoard(null)).toEqual(DEFAULT_BOARD);
    expect(normalizeBoard({ order: ["X", 3], hidden: "DONE", labels: 5, collapseAfter: 7 })).toEqual(DEFAULT_BOARD);
  });
  it("Reihenfolge: bekannte zuerst, fehlende hinten, keine Doppelten", () => {
    expect(normalizeBoard({ order: ["DONE", "DOING", "DONE"] }).order).toEqual(["DONE", "DOING", "TODO", "BLOCKED"]);
  });
  it("Namen gekürzt, leere weg; Einklappen nur mit erlaubten Werten", () => {
    const b = normalizeBoard({ labels: { TODO: "  Backlog  ", DOING: " ", DONE: "x".repeat(50) }, collapseAfter: 10 });
    expect(b.labels).toEqual({ TODO: "Backlog", DONE: "x".repeat(30) });
    expect(b.collapseAfter).toBe(10);
  });
  it("mindestens eine Spalte bleibt sichtbar", () => {
    expect(normalizeBoard({ hidden: ["BLOCKED", "BLOCKED"] }).hidden).toEqual(["BLOCKED"]);
    expect(normalizeBoard({ hidden: ["TODO", "DOING", "BLOCKED", "DONE"] }).hidden).toEqual([]);
    expect(hidesEverything({ hidden: ["TODO", "DOING", "BLOCKED", "DONE"] })).toBe(true);
    expect(hidesEverything({ hidden: ["TODO"] })).toBe(false);
  });
});

describe("KI-Sperre je Spalte (#76)", () => {
  it("übernimmt nur echte Spalten, ohne Doppelte", () => {
    expect(normalizeBoard({ aiLocked: ["BLOCKED", "BLOCKED", "QUATSCH", 3] }).aiLocked).toEqual(["BLOCKED"]);
    expect(normalizeBoard(null).aiLocked).toEqual([]);
  });
  it("sperrt Aufgabe selbst oder über ihre Spalte", () => {
    expect(isAiLocked({ aiLocked: true, status: "TODO" }, null)).toBe(true);
    expect(isAiLocked({ aiLocked: false, status: "BLOCKED" }, { aiLocked: ["BLOCKED"] })).toBe(true);
    expect(isAiLocked({ aiLocked: false, status: "TODO" }, { aiLocked: ["BLOCKED"] })).toBe(false);
  });
});

describe("Zusatz-Spalten (#76)", () => {
  const cfg = normalizeBoard({
    extra: [
      { key: "x1", label: " Review ", base: "DOING" },
      { key: "x1", label: "doppelt", base: "TODO" },
      { key: "y2", label: "falscher Schlüssel", base: "TODO" },
      { key: "x2", label: "", base: "TODO" },
      { key: "x3", label: "Warten", base: "QUATSCH" },
    ],
    order: ["x1", "TODO"],
    aiLocked: ["x1", "x9"],
  });
  it("übernimmt nur gültige Spalten und hängt sie an die Reihenfolge", () => {
    expect(cfg.extra).toEqual([{ key: "x1", label: "Review", base: "DOING" }]);
    expect(cfg.order).toEqual(["x1", "TODO", "DOING", "BLOCKED", "DONE"]);
    expect(cfg.aiLocked).toEqual(["x1"]);
  });
  it("Spalte einer Aufgabe folgt dem Status", () => {
    expect(columnKeyOf(cfg, { status: "DOING", column: "x1" })).toBe("x1");
    expect(columnKeyOf(cfg, { status: "DONE", column: "x1" })).toBe("DONE");
    expect(columnKeyOf(cfg, { status: "TODO", column: "x7" })).toBe("TODO");
    expect(baseOf(cfg, "x1")).toBe("DOING");
    expect(baseOf(cfg, "BLOCKED")).toBe("BLOCKED");
  });
  it("vergibt freie Schlüssel, höchstens sechs Spalten", () => {
    expect(nextExtraKey(cfg)).toBe("x2");
    const full = normalizeBoard({ extra: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ key: `x${i}`, label: `S${i}`, base: "TODO" })) });
    expect(full.extra).toHaveLength(6);
    expect(nextExtraKey(full)).toBeNull();
  });
  it("gesperrte Zusatz-Spalte sperrt nur ihre Aufgaben", () => {
    expect(isAiLocked({ aiLocked: false, status: "DOING", column: "x1" }, cfg)).toBe(true);
    expect(isAiLocked({ aiLocked: false, status: "DOING", column: null }, cfg)).toBe(false);
  });
  it("mit Zusatz-Spalten zählen alle zum Ausblenden", () => {
    expect(hidesEverything({ extra: [{ key: "x1", label: "R", base: "DOING" }], hidden: ["TODO", "DOING", "BLOCKED", "DONE"] })).toBe(false);
    expect(hidesEverything({ extra: [{ key: "x1", label: "R", base: "DOING" }], hidden: ["TODO", "DOING", "BLOCKED", "DONE", "x1"] })).toBe(true);
  });
});

describe("Spaltennamen für die KI (#96)", () => {
  const names = (s: string) => ({ TODO: "Offen", DOING: "In Arbeit", BLOCKED: "Blockiert", DONE: "Erledigt" })[s] ?? s;
  const cfg = normalizeBoard({ labels: { BLOCKED: "Kann gelöscht werden" }, extra: [{ key: "x1", label: "Review", base: "DOING" }], order: ["TODO", "DOING", "x1", "BLOCKED", "DONE"], aiLocked: ["x1"] });
  it("liefert alle Spalten mit sichtbarem Namen", () => {
    expect(boardColumns(cfg, names).map((c) => `${c.key}=${c.name}${c.aiLocked ? "🔒" : ""}`)).toEqual(["TODO=Offen", "DOING=In Arbeit", "x1=Review🔒", "BLOCKED=Kann gelöscht werden", "DONE=Erledigt"]);
  });
  it("Aufgabe trägt den umbenannten Namen, nicht den Status", () => {
    expect(columnNameOf(cfg, { status: "BLOCKED" }, names)).toBe("Kann gelöscht werden");
    expect(columnNameOf(cfg, { status: "DOING", column: "x1" }, names)).toBe("Review");
    expect(columnNameOf(cfg, { status: "DONE", column: "x1" }, names)).toBe("Erledigt");
  });
  it("nimmt Status, Schlüssel und Namen an", () => {
    expect(resolveColumnInput(cfg, "kann  gelöscht WERDEN", names)).toEqual({ key: "BLOCKED", status: "BLOCKED", column: null });
    expect(resolveColumnInput(cfg, "Review", names)).toEqual({ key: "x1", status: "DOING", column: "x1" });
    expect(resolveColumnInput(cfg, "done", names)).toEqual({ key: "DONE", status: "DONE", column: null });
    expect(resolveColumnInput(cfg, "Blockiert", names)).toEqual({ key: "BLOCKED", status: "BLOCKED", column: null });
    expect(resolveColumnInput(cfg, "Irgendwas", names)).toBeNull();
  });
});
