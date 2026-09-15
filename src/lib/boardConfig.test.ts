import { describe, expect, it } from "vitest";
import { DEFAULT_BOARD, hidesEverything, normalizeBoard } from "./boardConfig";

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
