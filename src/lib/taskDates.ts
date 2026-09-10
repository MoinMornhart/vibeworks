import type { Recurrence } from "@prisma/client";

// Reine Datumslogik für Aufgaben – ohne Datenbank, also auch im Browser
// nutzbar. Gerechnet wird auf Kalendertagen („YYYY-MM-DD“), nicht auf
// Stunden: eine heute fällige Aufgabe ist um 17 Uhr nicht überfällig.

export const RECURRENCES: Array<{ value: Recurrence; label: string }> = [
  { value: "DAILY", label: "Täglich" },
  { value: "WEEKLY", label: "Wöchentlich" },
  { value: "BIWEEKLY", label: "Alle zwei Wochen" },
  { value: "MONTHLY", label: "Monatlich" },
];

export function recurrenceLabel(r: Recurrence): string {
  return RECURRENCES.find((x) => x.value === r)?.label ?? r;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(v: string): boolean {
  return DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Einen Wiederholungsschritt (n-mal) weiter. Monatlich bleibt der Tag im
 *  Monat erhalten und wird nur am Monatsende gekappt: 31.01. → 28.02. */
export function addStep(key: string, rec: Recurrence, n = 1): string {
  const [y, m, d] = key.split("-").map(Number);
  if (rec === "MONTHLY") {
    const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))));
  }
  const days = rec === "DAILY" ? 1 : rec === "WEEKLY" ? 7 : 14;
  return iso(new Date(Date.UTC(y, m - 1, d + days * n)));
}

/** Nächster Termin einer wiederkehrenden Aufgabe – vom Fälligkeitsdatum aus
 *  gerechnet, nicht vom Tag des Abhakens, und so weit vorgerückt, bis er in
 *  der Zukunft liegt. Ohne Fälligkeit zählt heute als Ausgangspunkt. */
export function nextDueKey(dueKey: string | null, rec: Recurrence, todayKey: string): string {
  const base = dueKey ?? todayKey;
  let n = 1;
  let next = addStep(base, rec, n);
  while (next <= todayKey) next = addStep(base, rec, ++n);
  return next;
}

export function dayKeyToDate(key: string): Date {
  // Mittags UTC: bleibt in jeder europäischen Zeitzone derselbe Kalendertag.
  return new Date(`${key}T12:00:00Z`);
}

export function diffDays(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(dueKey: string, todayKey: string): DueState {
  const d = diffDays(todayKey, dueKey);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= 3 ? "soon" : "later";
}

const shortDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function formatDue(dueKey: string, todayKey: string): string {
  const d = diffDays(todayKey, dueKey);
  if (d === 0) return "heute";
  if (d === 1) return "morgen";
  if (d === -1) return "gestern";
  if (d < 0) return `seit ${-d} Tagen`;
  if (d < 7) return `in ${d} Tagen`;
  return shortDate.format(dayKeyToDate(dueKey));
}

// ── Fächer für die projektübergreifende Aufgabenliste ───────
// Projektübergreifend lautet die Frage „was ist fällig“, nicht „was steht
// wo im Brett“ – deshalb wird dort nach Fälligkeit gebündelt.

export type Bucket = "overdue" | "today" | "week" | "later" | "none";

export const BUCKETS: Array<{ value: Bucket; label: string }> = [
  { value: "overdue", label: "Überfällig" },
  { value: "today", label: "Heute" },
  { value: "week", label: "Diese Woche" },
  { value: "later", label: "Später" },
  { value: "none", label: "Ohne Termin" },
];

export function bucketOf(dueKey: string | null, todayKey: string): Bucket {
  if (!dueKey) return "none";
  const d = diffDays(todayKey, dueKey);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= 7 ? "week" : "later";
}

export function derivedProgress(total: number, done: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}
