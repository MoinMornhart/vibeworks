import { describe, expect, it } from "vitest";
import { COLOR_SCHEMES, DEFAULT_THEME, resolveTheme, themeSchema } from "./index";
import { contrast, mix, shiftHue } from "./color";
import { themeCss } from "./css";

describe("resolveTheme", () => {
  it("liefert die Vorgabe für Unsinn", () => {
    expect(resolveTheme(null)).toEqual(DEFAULT_THEME);
    expect(resolveTheme("kaputt")).toEqual(DEFAULT_THEME);
  });

  it("füllt fehlende Felder auf und behält gültige", () => {
    const t = resolveTheme({ accent: "#ff0000", glass: { blur: 5 } });
    expect(t.accent).toBe("#ff0000");
    expect(t.glass.blur).toBe(5);
    expect(t.glass.opacity).toBe(DEFAULT_THEME.glass.opacity);
    expect(themeSchema.safeParse(t).success).toBe(true);
  });

  it("verwirft nur den kaputten Bereich", () => {
    const t = resolveTheme({ accent: "rot", mode: "light" });
    expect(t.accent).toBe(DEFAULT_THEME.accent);
    expect(t.mode).toBe("light");
  });
});

describe("Farbschemata", () => {
  it("gedämpfter Text erreicht WCAG AA auf Karten", () => {
    for (const s of COLOR_SCHEMES) {
      for (const p of [s.dark, s.light]) {
        expect(contrast(p.muted, p.surface), `${s.id} muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.text, p.surface), `${s.id} text`).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe("Farbhilfen", () => {
  it("mischt und dreht Farbtöne", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(shiftHue("#ff0000", 120)).toBe("#00ff00");
  });

  it("System-Modus erzeugt eine Media-Query", () => {
    expect(themeCss({ ...DEFAULT_THEME, mode: "system" })).toContain("prefers-color-scheme: light");
    expect(themeCss(DEFAULT_THEME)).not.toContain("@media");
  });
});
