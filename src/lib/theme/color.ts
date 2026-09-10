// Kleine Farbhilfen ohne Abhängigkeiten – für Kontrastprüfung, abgeleitete
// Akzentfarben und Voreinstellungen der Hintergrund-Animationen.

export type RGB = [number, number, number];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative Leuchtdichte nach WCAG. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Kontrastverhältnis nach WCAG (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Schwarz oder Weiß – je nachdem, was auf `bg` besser lesbar ist. */
export function readableOn(bg: string): string {
  return contrast(bg, "#ffffff") >= contrast(bg, "#0b0b12") ? "#ffffff" : "#0b0b12";
}

/** Lineare Mischung zweier Farben, t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t) as RGB);
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [conv(hue + 1 / 3) * 255, conv(hue) * 255, conv(hue - 1 / 3) * 255];
}

/** Farbton um `deg` Grad drehen – für harmonische Begleitfarben. */
export function shiftHue(hex: string, deg: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h + deg, s, l));
}

/** Hex → "r g b" für rgb()-Ausdrücke mit Alpha in CSS. */
export function rgbTriplet(hex: string): string {
  return hexToRgb(hex).join(" ");
}
