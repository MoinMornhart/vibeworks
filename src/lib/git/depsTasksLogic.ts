import type { DepsReport, Severity, UpdateLevel } from "./depsLogic";

// Aufgaben aus dem Abhängigkeiten-Check – ohne Datenbank: was ist markiert,
// wie sieht die Liste aus, und was passiert mit der vorhandenen Aufgabe.

const DEPS_TASK_KEYS = ["deps:vuln", "deps:update"] as const;
export type DepsTaskKey = (typeof DEPS_TASK_KEYS)[number];

export interface DepsTaskPlan {
  key: DepsTaskKey;
  names: string[];
  lines: string[];
}

const LEVEL_ORDER: Record<UpdateLevel, number> = { major: 0, minor: 1, patch: 2, current: 3, unknown: 4 };

/**
 * Je Schlüssel die markierten Pakete: Sicherheitswarnungen für sich, alle
 * übrigen veralteten (Major, Minor, Patch) als Updates. Ohne package.json
 * oder bei einem Fehler null – dann bleiben die Aufgaben unangetastet.
 */
export function planDepsTasks(report: DepsReport, label: { severity: (s: Severity) => string; level: (l: UpdateLevel) => string }): DepsTaskPlan[] | null {
  if (!report.manifest || report.error) return null;
  const vuln = report.packages.filter((p) => p.advisories.length > 0);
  const outdated = report.packages
    .filter((p) => p.advisories.length === 0 && (p.level === "major" || p.level === "minor" || p.level === "patch"))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name));
  return [
    {
      key: "deps:vuln",
      names: vuln.map((p) => p.name),
      lines: vuln.map(
        (p) =>
          `- \`${p.name}\` ${p.range} → ${p.latest ?? "?"}: ${p.advisories
            .map((a) => (a.url ? `[${label.severity(a.severity)}: ${a.title}](${a.url})` : `${label.severity(a.severity)}: ${a.title}`))
            .join("; ")}`,
      ),
    },
    { key: "deps:update", names: outdated.map((p) => p.name), lines: outdated.map((p) => `- \`${p.name}\` ${p.range} → ${p.latest ?? "?"} (${label.level(p.level)})`) },
  ];
}

/** Paketnamen aus einer früheren Beschreibung („- `name` …“). */
export function namesIn(description: string | null): string[] {
  return [...(description ?? "").matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]);
}

/** Die ersten drei Namen für den Titel. */
export const shortList = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(", ")} …` : names.join(", "));

export type DepsTaskAction = "create" | "update" | "reopen" | "close" | "none";

/**
 * Was mit der vorhandenen Aufgabe geschieht: offen → aktualisieren oder, wenn
 * nichts mehr markiert ist, erledigen. Erledigt → nur wieder öffnen, wenn ein
 * Paket dazukommt, das beim Erledigen noch nicht auf der Liste stand.
 */
export function depsTaskAction(existing: { status: string; description: string | null } | null, plan: { names: string[]; description: string }): DepsTaskAction {
  const marked = plan.names.length > 0;
  if (!existing) return marked ? "create" : "none";
  if (existing.status === "DONE") {
    if (!marked) return "none";
    const before = new Set(namesIn(existing.description));
    return plan.names.some((n) => !before.has(n)) ? "reopen" : "none";
  }
  if (!marked) return "close";
  return existing.description === plan.description ? "none" : "update";
}
