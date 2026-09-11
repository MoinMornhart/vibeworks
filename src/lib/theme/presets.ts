import type { GradientKind } from "./index";

// Verlaufsvorlagen. Die Anzeigenamen der Verläufe und Hintergrund-Vorlagen
// stehen im Übersetzungs-Namensraum „theme“ (gradients.<id>, backgrounds.<id>).

export type GradientPresetId = "night" | "violet" | "sunset" | "ocean" | "lagoon" | "forest" | "peach" | "cotton" | "prism" | "ember";

export interface GradientPreset {
  id: GradientPresetId;
  kind: GradientKind;
  angle: number;
  stops: Array<{ color: string; pos: number }>;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "night", kind: "linear", angle: 160, stops: [{ color: "#0f0c29", pos: 0 }, { color: "#302b63", pos: 55 }, { color: "#24243e", pos: 100 }] },
  { id: "violet", kind: "linear", angle: 135, stops: [{ color: "#1e1b4b", pos: 0 }, { color: "#6d28d9", pos: 50 }, { color: "#0e7490", pos: 100 }] },
  { id: "sunset", kind: "linear", angle: 135, stops: [{ color: "#3a1c71", pos: 0 }, { color: "#d76d77", pos: 55 }, { color: "#ffaf7b", pos: 100 }] },
  { id: "ocean", kind: "linear", angle: 180, stops: [{ color: "#0f2027", pos: 0 }, { color: "#203a43", pos: 50 }, { color: "#2c5364", pos: 100 }] },
  { id: "lagoon", kind: "radial", angle: 0, stops: [{ color: "#43cea2", pos: 0 }, { color: "#185a9d", pos: 70 }, { color: "#0b1d3a", pos: 100 }] },
  { id: "forest", kind: "radial", angle: 0, stops: [{ color: "#a8e063", pos: 0 }, { color: "#2f7336", pos: 45 }, { color: "#07130b", pos: 100 }] },
  { id: "peach", kind: "linear", angle: 120, stops: [{ color: "#ffecd2", pos: 0 }, { color: "#fcb69f", pos: 100 }] },
  { id: "cotton", kind: "linear", angle: 45, stops: [{ color: "#fbc2eb", pos: 0 }, { color: "#a6c1ee", pos: 100 }] },
  { id: "prism", kind: "conic", angle: 0, stops: [{ color: "#ff5f6d", pos: 0 }, { color: "#ffc371", pos: 20 }, { color: "#47e5bc", pos: 45 }, { color: "#4facfe", pos: 70 }, { color: "#b06ab3", pos: 90 }] },
  { id: "ember", kind: "radial", angle: 0, stops: [{ color: "#f12711", pos: 0 }, { color: "#f5af19", pos: 35 }, { color: "#1a0500", pos: 100 }] },
];
