// Wochenbericht (#82) ohne Datenbank: aus den gesammelten Zahlen der letzten
// Woche einen kurzen Text bauen – erledigte Aufgaben, Workflow-Durchläufe mit
// Belegen, neue Fehler, schlafende Projekte. Leere Woche → kein Bericht.

export interface WeeklyReportData {
  done: Array<{ title: string; project: string }>;
  doneTotal: number;
  runs: Array<{ title: string; project: string; steps: number; proven: number }>;
  errors: Array<{ project: string; count: number }>;
  sleeping: Array<{ project: string; days: number }>;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const MAX_LINES = 5;

export const isEmptyReport = (d: WeeklyReportData) => !d.doneTotal && !d.runs.length && !d.errors.length && !d.sleeping.length;

/** Abschnitte je Thema, jeweils Überschrift und höchstens fünf Zeilen. */
export function weeklyReportText(d: WeeklyReportData, t: Translate): string {
  const parts: string[] = [];
  const section = (head: string, lines: string[], total: number) => {
    const shown = lines.slice(0, MAX_LINES);
    if (total > shown.length) shown.push(t("more", { n: total - shown.length }));
    parts.push([head, ...shown].join("\n"));
  };
  if (d.doneTotal) section(t("done", { n: d.doneTotal }), d.done.map((x) => `• ${x.title} (${x.project})`), d.doneTotal);
  if (d.runs.length) {
    section(
      t("runs", { n: d.runs.length }),
      d.runs.map((r) => `• ${r.title} (${r.project}) – ${t("proven", { proven: r.proven, steps: r.steps })}`),
      d.runs.length,
    );
  }
  if (d.errors.length) {
    const total = d.errors.reduce((n, e) => n + e.count, 0);
    section(t("errors", { n: total }), d.errors.map((e) => `• ${e.project}: ${e.count}`), d.errors.length);
  }
  if (d.sleeping.length) {
    section(t("sleeping", { n: d.sleeping.length }), d.sleeping.map((s) => `• ${s.project} – ${t("days", { n: s.days })}`), d.sleeping.length);
  }
  return parts.join("\n\n");
}

/** Belegte Schritte eines Durchlaufs: erledigt mit Notiz. */
export function provenSteps(results: unknown): number {
  if (!Array.isArray(results)) return 0;
  return results.filter((r) => {
    const x = r as { status?: unknown; note?: unknown } | null;
    return x?.status === "done" && typeof x.note === "string" && x.note.trim().length > 0;
  }).length;
}
