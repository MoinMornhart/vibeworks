import type { BackgroundPresetId, GradientKind } from "./index";

export const BACKGROUND_PRESET_INFO: Record<BackgroundPresetId, { name: string; hint: string }> = {
  nebula: { name: "Nebel", hint: "Weiche Farbwolken driften über ein feines Raster" },
  starfield: { name: "Sternenhimmel", hint: "Funkelnde Sterne, ab und zu eine Sternschnuppe" },
  aurora: { name: "Polarlicht", hint: "Wogende Lichtbänder am Himmel" },
  particles: { name: "Partikelnetz", hint: "Verbundene Punkte, reagieren auf die Maus" },
  waves: { name: "Wellen", hint: "Sanft rollende Farbwellen" },
  mesh: { name: "Mesh", hint: "Fließender Farbverlauf aus vier Flecken" },
  synthwave: { name: "Synthwave", hint: "Retro-Sonne über einem endlosen Raster" },
  bokeh: { name: "Bokeh", hint: "Aufsteigende, unscharfe Lichtkreise" },
  plain: { name: "Schlicht", hint: "Nur die Grundfarbe – ruhig und sparsam" },
};

export interface GradientPreset {
  id: string;
  name: string;
  kind: GradientKind;
  angle: number;
  stops: Array<{ color: string; pos: number }>;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "night", name: "Nachthimmel", kind: "linear", angle: 160, stops: [{ color: "#0f0c29", pos: 0 }, { color: "#302b63", pos: 55 }, { color: "#24243e", pos: 100 }] },
  { id: "violet", name: "Violett", kind: "linear", angle: 135, stops: [{ color: "#1e1b4b", pos: 0 }, { color: "#6d28d9", pos: 50 }, { color: "#0e7490", pos: 100 }] },
  { id: "sunset", name: "Sonnenuntergang", kind: "linear", angle: 135, stops: [{ color: "#3a1c71", pos: 0 }, { color: "#d76d77", pos: 55 }, { color: "#ffaf7b", pos: 100 }] },
  { id: "ocean", name: "Tiefsee", kind: "linear", angle: 180, stops: [{ color: "#0f2027", pos: 0 }, { color: "#203a43", pos: 50 }, { color: "#2c5364", pos: 100 }] },
  { id: "lagoon", name: "Lagune", kind: "radial", angle: 0, stops: [{ color: "#43cea2", pos: 0 }, { color: "#185a9d", pos: 70 }, { color: "#0b1d3a", pos: 100 }] },
  { id: "forest", name: "Waldlichtung", kind: "radial", angle: 0, stops: [{ color: "#a8e063", pos: 0 }, { color: "#2f7336", pos: 45 }, { color: "#07130b", pos: 100 }] },
  { id: "peach", name: "Pfirsich", kind: "linear", angle: 120, stops: [{ color: "#ffecd2", pos: 0 }, { color: "#fcb69f", pos: 100 }] },
  { id: "cotton", name: "Zuckerwatte", kind: "linear", angle: 45, stops: [{ color: "#fbc2eb", pos: 0 }, { color: "#a6c1ee", pos: 100 }] },
  { id: "prism", name: "Prisma", kind: "conic", angle: 0, stops: [{ color: "#ff5f6d", pos: 0 }, { color: "#ffc371", pos: 20 }, { color: "#47e5bc", pos: 45 }, { color: "#4facfe", pos: 70 }, { color: "#b06ab3", pos: 90 }] },
  { id: "ember", name: "Glut", kind: "radial", angle: 0, stops: [{ color: "#f12711", pos: 0 }, { color: "#f5af19", pos: 35 }, { color: "#1a0500", pos: 100 }] },
];
