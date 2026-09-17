import { describe, expect, it } from "vitest";
import { EMPTY_UI_PREFS, hiddenCount, hider, MINIMAL_HIDDEN, readUiPrefs, UI_GROUPS, UI_KEYS } from "./uiPrefsLogic";

describe("Ansicht aufräumen (#109)", () => {
  it("jeder Schlüssel steht in genau einer Gruppe", () => {
    const all = UI_GROUPS.flatMap((g) => [...g.keys]);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([...UI_KEYS].sort());
  });

  it("liest gespeicherte Auswahl tolerant und wirft Unbekanntes weg", () => {
    expect(readUiPrefs(null)).toEqual(EMPTY_UI_PREFS);
    expect(readUiPrefs({ hidden: "nav.docs" })).toEqual(EMPTY_UI_PREFS);
    expect(readUiPrefs({ hidden: ["nav.docs", "gibt.es.nicht", 7] })).toEqual({ hidden: ["nav.docs"] });
  });

  it("zeigt alles, was nicht ausgeblendet ist", () => {
    const show = hider(readUiPrefs({ hidden: ["project.ci", "nav.community"] }));
    expect(show("project.ci")).toBe(false);
    expect(show("nav.community")).toBe(false);
    expect(show("project.git")).toBe(true);
    expect(hiddenCount(readUiPrefs({ hidden: ["project.ci", "nav.community"] }))).toBe(2);
  });

  it("„Nur das Nötigste“ lässt die Aufgaben stehen", () => {
    expect(MINIMAL_HIDDEN).not.toContain("nav.tasks");
    expect(MINIMAL_HIDDEN).toContain("project.lighthouse");
    expect(MINIMAL_HIDDEN.length).toBe(UI_KEYS.length - 1);
  });
});
