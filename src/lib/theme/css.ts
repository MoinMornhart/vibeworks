import { mix, readableOn, rgbTriplet } from "./color";
import { presetColors, STATUS_KEYS, type Palette, type Theme } from "./index";

// Erzeugt die CSS-Variablen eines Designs. Serverseitig in <head>
// eingebettet, damit schon der erste Frame richtig aussieht; im Editor
// clientseitig neu gesetzt für die Live-Vorschau.

function paletteVars(p: Palette, accent: string, dark: boolean): string {
  const accentText = readableOn(accent);
  // Akzent auf der Kartenfläche als Textfarbe muss lesbar bleiben:
  // im Hellmodus etwas abdunkeln, im Dunkelmodus etwas aufhellen.
  const accentInk = dark ? mix(accent, "#ffffff", 0.18) : mix(accent, "#000000", 0.28);
  return [
    `color-scheme:${dark ? "dark" : "light"}`,
    `--vw-bg:${p.bg}`,
    `--vw-bg-rgb:${rgbTriplet(p.bg)}`,
    `--vw-surface:${p.surface}`,
    `--vw-surface-rgb:${rgbTriplet(p.surface)}`,
    `--vw-elevated:${p.elevated}`,
    `--vw-text:${p.text}`,
    `--vw-muted:${p.muted}`,
    `--vw-border:${p.border}`,
    `--vw-accent-ink:${accentInk}`,
    `--vw-accent-contrast:${accentText}`,
    `--vw-shadow:${dark ? "0 10px 40px -12px rgb(0 0 0 / .65)" : "0 10px 30px -14px rgb(20 20 50 / .25)"}`,
  ].join(";");
}

export function themeVars(theme: Theme): { common: string; dark: string; light: string } {
  const [c1, c2, c3] = presetColors(theme);
  const common = [
    `--vw-accent:${theme.accent}`,
    `--vw-accent-rgb:${rgbTriplet(theme.accent)}`,
    `--vw-bg-1:${c1}`,
    `--vw-bg-2:${c2}`,
    `--vw-bg-3:${c3}`,
    `--vw-glass-opacity:${theme.glass.opacity / 100}`,
    `--vw-glass-blur:${theme.glass.blur}px`,
    ...STATUS_KEYS.map((k) => `--vw-status-${k.toLowerCase().replace("_", "-")}:${theme.status[k]}`),
  ].join(";");
  return {
    common,
    dark: paletteVars(theme.dark, theme.accent, true),
    light: paletteVars(theme.light, theme.accent, false),
  };
}

/** Komplettes Stylesheet für <style id="vw-theme">. */
export function themeCss(theme: Theme): string {
  const v = themeVars(theme);
  if (theme.mode === "dark") return `:root{${v.common};${v.dark}}`;
  if (theme.mode === "light") return `:root{${v.common};${v.light}}`;
  return `:root{${v.common};${v.dark}}@media (prefers-color-scheme: light){:root{${v.light}}}`;
}
