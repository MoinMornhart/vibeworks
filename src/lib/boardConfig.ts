import type { TaskStatus } from "@/generated/prisma/client";

// Einstellungen des Aufgabenbretts je Projekt: Namen, Reihenfolge und
// Sichtbarkeit der Spalten und ab wie vielen Karten eine Spalte einklappt.
// Der Status dahinter bleibt immer derselbe (auch für die Issues) – nur die
// Darstellung ändert sich. Zusatz-Spalten (#76) hängen an einer Grundspalte:
// ihre Aufgaben haben deren Status und merken sich die Spalte in Task.column.

export const BOARD_STATUSES = ["TODO", "DOING", "BLOCKED", "DONE"] as const satisfies readonly TaskStatus[];
/** 0 = wie für die Instanz eingestellt */
export const COLLAPSE_OPTIONS = [0, 5, 10, 20, 50] as const;
export const MAX_COLUMN_LABEL = 30;
export const MAX_EXTRA_COLUMNS = 6;
/** Schlüssel einer Zusatz-Spalte: x1 … x9 */
export const EXTRA_KEY = /^x[1-9]$/;

/** Eine Spalte: ein Status oder eine Zusatz-Spalte (x1 …) */
export type ColumnKey = string;

export interface ExtraColumn {
  key: string;
  label: string;
  /** Grundspalte – bestimmt den Status der Aufgaben */
  base: TaskStatus;
}

export interface BoardConfig {
  order: ColumnKey[];
  hidden: ColumnKey[];
  labels: Partial<Record<TaskStatus, string>>;
  collapseAfter: number;
  /** Für KI gesperrte Spalten (#76) */
  aiLocked: ColumnKey[];
  /** Eigene Zusatz-Spalten (#76) */
  extra: ExtraColumn[];
}

/** Eigene Spaltennamen eines Projekts (#72) samt Zusatz-Spalten – für Liste, Dialog, Info-Fenster und Team-Seite. */
export type StatusLabels = Partial<Record<string, string>>;
export const statusLabelsOf = (stored: unknown): StatusLabels => {
  const b = normalizeBoard(stored);
  return { ...b.labels, ...Object.fromEntries(b.extra.map((x) => [x.key, x.label])) };
};

export const DEFAULT_BOARD: BoardConfig = { order: [...BOARD_STATUSES], hidden: [], labels: {}, collapseAfter: 0, aiLocked: [], extra: [] };

const isStatus = (v: unknown): v is TaskStatus => typeof v === "string" && (BOARD_STATUSES as readonly string[]).includes(v);
export const isExtraKey = (v: unknown): v is string => typeof v === "string" && EXTRA_KEY.test(v);

function normalizeExtra(input: unknown): ExtraColumn[] {
  const out: ExtraColumn[] = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const label = typeof x.label === "string" ? x.label.trim().slice(0, MAX_COLUMN_LABEL) : "";
    if (!isExtraKey(x.key) || !isStatus(x.base) || !label || out.some((e) => e.key === x.key)) continue;
    out.push({ key: x.key, label, base: x.base });
    if (out.length >= MAX_EXTRA_COLUMNS) break;
  }
  return out;
}

/** Gespeicherten oder gesendeten Wert aufräumen – Unbekanntes fällt auf den Standard zurück, mindestens eine Spalte bleibt sichtbar. */
export function normalizeBoard(input: unknown): BoardConfig {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const extra = normalizeExtra(o.extra);
  const known = new Set<string>([...BOARD_STATUSES, ...extra.map((x) => x.key)]);
  const isKnown = (v: unknown): v is string => typeof v === "string" && known.has(v);
  const order = [...new Set((Array.isArray(o.order) ? o.order : []).filter(isKnown))];
  for (const k of known) if (!order.includes(k)) order.push(k);
  let hidden = [...new Set((Array.isArray(o.hidden) ? o.hidden : []).filter(isKnown))];
  if (hidden.length >= known.size) hidden = [];
  const labels: BoardConfig["labels"] = {};
  if (o.labels && typeof o.labels === "object") {
    for (const s of BOARD_STATUSES) {
      const v = (o.labels as Record<string, unknown>)[s];
      if (typeof v === "string" && v.trim()) labels[s] = v.trim().slice(0, MAX_COLUMN_LABEL);
    }
  }
  const c = Number(o.collapseAfter);
  const collapseAfter = (COLLAPSE_OPTIONS as readonly number[]).includes(c) ? c : 0;
  const aiLocked = [...new Set((Array.isArray(o.aiLocked) ? o.aiLocked : []).filter(isKnown))];
  return { order, hidden, labels, collapseAfter, aiLocked, extra };
}

/** Würden alle Spalten ausgeblendet? (Das lehnt die API ab.) */
export function hidesEverything(input: unknown): boolean {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const b = normalizeBoard({ ...o, hidden: [] });
  const hidden = Array.isArray(o.hidden) ? o.hidden : [];
  return new Set(hidden.filter((h) => b.order.includes(h as string))).size >= b.order.length;
}

/** Grundstatus einer Spalte. */
export function baseOf(cfg: Pick<BoardConfig, "extra">, key: ColumnKey): TaskStatus {
  return cfg.extra.find((x) => x.key === key)?.base ?? (isStatus(key) ? key : "TODO");
}

/**
 * In welcher Spalte steht die Aufgabe? Die Zusatz-Spalte gilt nur, solange der
 * Status zu ihrer Grundspalte passt – sonst die Grundspalte des Status.
 */
export function columnKeyOf(cfg: Pick<BoardConfig, "extra">, task: { status: TaskStatus; column?: string | null }): ColumnKey {
  const extra = task.column ? cfg.extra.find((x) => x.key === task.column) : undefined;
  return extra && extra.base === task.status ? extra.key : task.status;
}

/** Nächster freier Schlüssel für eine neue Zusatz-Spalte – null, wenn alle belegt sind. */
export function nextExtraKey(cfg: Pick<BoardConfig, "extra">): string | null {
  if (cfg.extra.length >= MAX_EXTRA_COLUMNS) return null;
  for (let i = 1; i <= 9; i++) if (!cfg.extra.some((x) => x.key === `x${i}`)) return `x${i}`;
  return null;
}
