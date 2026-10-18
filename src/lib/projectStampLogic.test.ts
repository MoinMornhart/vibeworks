import { describe, expect, it } from "vitest";
import { stampFrom } from "./projectStampLogic";

describe("Änderungsstempel der Projektseite (#214)", () => {
  const t = new Date("2026-10-17T10:00:00Z");

  it("bleibt gleich, solange sich nichts ändert", () => {
    expect(stampFrom([t, 3, "abc", null])).toBe(stampFrom([new Date(t), 3, "abc", null]));
    expect(stampFrom([t, 3])).toMatch(/^[0-9a-f]{8}$/);
  });

  it("ändert sich bei jeder Änderung eines Teils", () => {
    const base = stampFrom([t, 3, "abc", null]);
    expect(stampFrom([new Date(t.getTime() + 1), 3, "abc", null])).not.toBe(base);
    expect(stampFrom([t, 4, "abc", null])).not.toBe(base);
    expect(stampFrom([t, 3, "abd", null])).not.toBe(base);
    expect(stampFrom([t, 3, "abc", "Fehler"])).not.toBe(base);
  });

  it("verwechselt verschobene Teile nicht", () => {
    expect(stampFrom(["a", "bc"])).not.toBe(stampFrom(["ab", "c"]));
  });
});
