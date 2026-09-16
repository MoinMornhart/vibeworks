import type { CheckReport } from "./repoCheckLogic";

// Aufgaben aus dem Repo-Check (#47) – ohne Datenbank: welche Befunde zählen,
// wie die Liste aussieht und welche Werte Erklärung und Auftrag bekommen.

export const CHECK_TASK_MODES = ["off", "urgent", "all"] as const;
export type CheckTaskMode = (typeof CHECK_TASK_MODES)[number];
export const isCheckTaskMode = (v: unknown): v is CheckTaskMode => (CHECK_TASK_MODES as readonly unknown[]).includes(v);

export const CHECK_KINDS = ["secrets", "vulnerabilities", "findings"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];
export const CHECK_TASK_KEYS: Record<CheckKind, string> = { secrets: "check:secrets", vulnerabilities: "check:vulns", findings: "check:findings" };
const TOOL: Record<CheckKind, keyof CheckReport["tools"]> = { secrets: "gitleaks", vulnerabilities: "osv", findings: "semgrep" };
const MAX_LINES = 50;

const at = (file: string, line: number | null) => `${file}${line ? `:${line}` : ""}`;
// Backticks würden die Liste in der Beschreibung zerbrechen
const clean = (s: string) => s.replace(/`/g, "'").slice(0, 200);

export interface CheckItem {
  /** Eindeutig je Befund – steht in der Aufgabenliste in Backticks */
  id: string;
  /** Werte für die Texte (wie im Panel) */
  vars: Record<string, string>;
  detail: string;
}

export function checkItems(report: CheckReport, kind: CheckKind): CheckItem[] {
  if (kind === "secrets") {
    return report.secrets.map((s) => ({ id: clean(`${at(s.file, s.line)} ${s.rule}`), vars: { rule: s.rule || "?", file: at(s.file, s.line) }, detail: clean(s.description || "") }));
  }
  if (kind === "vulnerabilities") {
    return report.vulnerabilities.map((v) => ({
      id: clean(`${v.package}@${v.version} ${v.id}`),
      vars: { pkg: v.package, version: v.version || "?", id: v.id || "?" },
      detail: clean([v.severity && `CVSS ${v.severity}`, v.summary].filter(Boolean).join(" · ")),
    }));
  }
  return report.findings.map((x) => ({ id: clean(`${at(x.file, x.line)} ${x.rule}`), vars: { rule: x.rule || "?", file: at(x.file, x.line) }, detail: clean(x.message || "") }));
}

export interface CheckTaskPlan {
  key: string;
  kind: CheckKind;
  names: string[];
  lines: string[];
}

/**
 * Welche Sammel-Aufgaben es geben soll. „urgent“: Geheimnisse und Lücken,
 * „all“: dazu die Semgrep-Befunde. Werkzeuge, die nicht gelaufen sind, fehlen
 * im Plan – ihre Aufgaben bleiben dann unangetastet.
 */
export function planCheckTasks(report: CheckReport, mode: CheckTaskMode): CheckTaskPlan[] {
  if (mode === "off") return [];
  const kinds: CheckKind[] = mode === "urgent" ? ["secrets", "vulnerabilities"] : [...CHECK_KINDS];
  return kinds
    .filter((k) => report.tools[TOOL[k]])
    .map((kind) => {
      const unique = new Map<string, CheckItem>();
      for (const item of checkItems(report, kind)) if (!unique.has(item.id)) unique.set(item.id, item);
      const items = [...unique.values()];
      const shown = items.slice(0, MAX_LINES);
      const lines = shown.map((i) => `- \`${i.id}\`${i.detail ? ` – ${i.detail}` : ""}`);
      if (items.length > shown.length) lines.push(`- … +${items.length - shown.length}`);
      return { key: CHECK_TASK_KEYS[kind], kind, names: items.map((i) => i.id), lines };
    });
}
