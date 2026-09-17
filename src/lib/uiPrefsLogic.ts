// Ansicht aufräumen (#109): Wer Teile von VibeWorks nicht braucht, blendet sie
// aus – je Konto, jederzeit umkehrbar. Ausgeblendet wird nur Zusätzliches;
// Projekte, Aufgaben und Notizen bleiben immer da. Ohne Datenbank.

export const UI_GROUPS = [
  {
    key: "nav",
    keys: ["nav.today", "nav.tasks", "nav.prompts", "nav.review", "nav.community", "nav.docs", "menu.teams", "menu.inbox", "menu.costs"],
  },
  {
    key: "dashboard",
    keys: ["dash.suggestions", "dash.sleeping", "dash.shared", "dash.graveyard"],
  },
  {
    key: "project",
    keys: [
      "project.live",
      "project.errors",
      "project.structure",
      "project.workflows",
      "project.keys",
      "project.costs",
      "project.git",
      "project.deps",
      "project.repoCheck",
      "project.ci",
      "project.lighthouse",
      "project.conflicts",
      "project.fileFilter",
      "project.codeGraph",
    ],
  },
] as const satisfies ReadonlyArray<{ key: string; keys: readonly string[] }>;

export type UiKey = (typeof UI_GROUPS)[number]["keys"][number];

/** Alles, was sich ausblenden lässt. */
export const UI_KEYS: readonly string[] = UI_GROUPS.flatMap((g) => [...g.keys]);

/** „Nur das Nötigste“: alles Zusätzliche aus – Projekte, Aufgaben und Notizen bleiben. */
export const MINIMAL_HIDDEN: readonly string[] = UI_KEYS.filter((k) => k !== "nav.tasks");

export interface UiPrefs {
  hidden: string[];
}

export const EMPTY_UI_PREFS: UiPrefs = { hidden: [] };

/** Gespeicherte Auswahl tolerant lesen – Unbekanntes fällt weg. */
export function readUiPrefs(raw: unknown): UiPrefs {
  if (!raw || typeof raw !== "object") return EMPTY_UI_PREFS;
  const list = (raw as { hidden?: unknown }).hidden;
  if (!Array.isArray(list)) return EMPTY_UI_PREFS;
  return { hidden: UI_KEYS.filter((k) => list.includes(k)) };
}

/** Prüffunktion für Seiten und Komponenten. */
export function hider(prefs: UiPrefs): (key: UiKey) => boolean {
  const hidden = new Set(prefs.hidden);
  return (key) => !hidden.has(key);
}

/** Zahl der ausgeblendeten Teile – für den Hinweis in der Oberfläche. */
export const hiddenCount = (prefs: UiPrefs): number => prefs.hidden.length;
