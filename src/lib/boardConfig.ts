import type { TaskStatus } from "@/generated/prisma/client";

// Einstellungen des Aufgabenbretts je Projekt: Namen, Reihenfolge und
// Sichtbarkeit der Spalten und ab wie vielen Karten eine Spalte einklappt.
// Der Status dahinter bleibt immer derselbe (auch für die Issues) – nur die
// Darstellung ändert sich.

export const BOARD_STATUSES = ["TODO", "DOING", "BLOCKED", "DONE"] as const satisfies readonly TaskStatus[];
/** 0 = wie für die Instanz eingestellt */
export const COLLAPSE_OPTIONS = [0, 5, 10, 20, 50] as const;
export const MAX_COLUMN_LABEL = 30;

export interface BoardConfig {
  order: TaskStatus[];
  hidden: TaskStatus[];
  labels: Partial<Record<TaskStatus, string>>;
  collapseAfter: number;
}

export const DEFAULT_BOARD: BoardConfig = { order: [...BOARD_STATUSES], hidden: [], labels: {}, collapseAfter: 0 };

const isStatus = (v: unknown): v is TaskStatus => typeof v === "string" && (BOARD_STATUSES as readonly string[]).includes(v);

/** Gespeicherten oder gesendeten Wert aufräumen – Unbekanntes fällt auf den Standard zurück, mindestens eine Spalte bleibt sichtbar. */
export function normalizeBoard(input: unknown): BoardConfig {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const order = [...new Set((Array.isArray(o.order) ? o.order : []).filter(isStatus))];
  for (const s of BOARD_STATUSES) if (!order.includes(s)) order.push(s);
  let hidden = [...new Set((Array.isArray(o.hidden) ? o.hidden : []).filter(isStatus))];
  if (hidden.length >= BOARD_STATUSES.length) hidden = [];
  const labels: BoardConfig["labels"] = {};
  if (o.labels && typeof o.labels === "object") {
    for (const s of BOARD_STATUSES) {
      const v = (o.labels as Record<string, unknown>)[s];
      if (typeof v === "string" && v.trim()) labels[s] = v.trim().slice(0, MAX_COLUMN_LABEL);
    }
  }
  const c = Number(o.collapseAfter);
  const collapseAfter = (COLLAPSE_OPTIONS as readonly number[]).includes(c) ? c : 0;
  return { order, hidden, labels, collapseAfter };
}

/** Würden alle Spalten ausgeblendet? (Das lehnt die API ab.) */
export function hidesEverything(input: unknown): boolean {
  const hidden = (input && typeof input === "object" ? (input as Record<string, unknown>).hidden : null) as unknown;
  return Array.isArray(hidden) && new Set(hidden.filter(isStatus)).size >= BOARD_STATUSES.length;
}
