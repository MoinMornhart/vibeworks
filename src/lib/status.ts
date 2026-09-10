import type { ProjectStatus, TaskStatus } from "@prisma/client";

export const PROJECT_STATUSES: Array<{ value: ProjectStatus; label: string; hint: string; cssVar: string }> = [
  { value: "IDEA", label: "Idee", hint: "Noch ein Gedanke – nichts gebaut, nichts entschieden", cssVar: "--vw-status-idea" },
  { value: "PLANNING", label: "In Planung", hint: "Umfang, Stack und Schnitt werden festgelegt", cssVar: "--vw-status-planning" },
  { value: "OPEN", label: "Offen", hint: "Startklar, liegt aber gerade still", cssVar: "--vw-status-open" },
  { value: "IN_PROGRESS", label: "In Entwicklung", hint: "Wird aktiv gebaut", cssVar: "--vw-status-in-progress" },
  { value: "DONE", label: "Fertig", hint: "Ausgeliefert und abgeschlossen", cssVar: "--vw-status-done" },
  { value: "ARCHIVED", label: "Archiviert", hint: "Ruht – bleibt erhalten, im Board ausgeblendet", cssVar: "--vw-status-archived" },
];

export const PROJECT_STATUS_MAP = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.value, s])) as Record<
  ProjectStatus,
  (typeof PROJECT_STATUSES)[number]
>;

export const TASK_STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: "TODO", label: "Offen" },
  { value: "DOING", label: "In Arbeit" },
  { value: "BLOCKED", label: "Blockiert" },
  { value: "DONE", label: "Erledigt" },
];

export const PRIORITIES = [
  { value: 1, label: "Niedrig" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Hoch" },
  { value: 4, label: "Kritisch" },
] as const;

export function priorityLabel(p: number): string {
  return PRIORITIES.find((x) => x.value === p)?.label ?? "Normal";
}

/** Akzentverläufe für Projektkarten. */
export const PROJECT_ACCENTS: Record<string, { label: string; from: string; to: string }> = {
  violet: { label: "Violett", from: "#8b5cf6", to: "#d946ef" },
  cyan: { label: "Cyan", from: "#22d3ee", to: "#3b82f6" },
  emerald: { label: "Smaragd", from: "#34d399", to: "#14b8a6" },
  amber: { label: "Bernstein", from: "#fbbf24", to: "#f97316" },
  rose: { label: "Rose", from: "#fb7185", to: "#e11d48" },
  blue: { label: "Blau", from: "#60a5fa", to: "#6366f1" },
};
