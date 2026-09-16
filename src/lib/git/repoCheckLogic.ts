// Repo-Check ohne Netz und Datenbank: den Bericht aus dem Artefakt einlesen.
// Der Inhalt stammt aus einem Workflow im Repository – also fremd. Deshalb
// wird alles auf erwartete Typen gebracht und begrenzt.

export interface CheckSecret { file: string; line: number | null; rule: string; description: string; commit: string }
export interface CheckVuln { package: string; version: string; ecosystem: string; id: string; summary: string; severity: string; source: string }
export interface CheckFinding { file: string; line: number | null; rule: string; severity: string; message: string }
export interface CheckTodo { file: string; line: number | null; text: string }

export interface CheckReport {
  commit: string;
  finishedAt: string | null;
  /** semgrep: Befunde wurden geprüft (Semgrep oder ein Sprachwerkzeug) */
  tools: { gitleaks: boolean; osv: boolean; semgrep: boolean; todos: boolean; extra: string[] };
  secrets: CheckSecret[];
  vulnerabilities: CheckVuln[];
  findings: CheckFinding[];
  todos: CheckTodo[];
  counts: { secrets: number; vulnerabilities: number; findings: number; todos: number };
}

const MAX = 300;
type Row = Record<string, unknown>;
const rows = (v: unknown, max = MAX): Row[] => (Array.isArray(v) ? v.filter((x): x is Row => Boolean(x) && typeof x === "object").slice(0, max) : []);
/** Sprachwerkzeuge im Bericht (#92) */
export const EXTRA_TOOLS = ["bandit", "shellcheck", "hadolint", "actionlint"] as const;
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);
const bool = (v: unknown) => v === true;

export function parseCheckReport(raw: unknown): CheckReport {
  const r = (raw && typeof raw === "object" ? raw : {}) as Row;
  const tools = (r.tools && typeof r.tools === "object" ? r.tools : {}) as Row;
  const secrets = rows(r.secrets).map((x) => ({ file: str(x.file, 500), line: num(x.line), rule: str(x.rule, 100), description: str(x.description, 200), commit: str(x.commit, 40) }));
  const vulnerabilities = rows(r.vulnerabilities).map((x) => ({
    package: str(x.package, 200),
    version: str(x.version, 60),
    ecosystem: str(x.ecosystem, 40),
    id: str(x.id, 80),
    summary: str(x.summary, 300),
    severity: str(x.severity, 20),
    source: str(x.source, 500),
  }));
  const findings = rows(r.findings, 400).map((x) => ({ file: str(x.file, 500), line: num(x.line), rule: str(x.rule, 200), severity: str(x.severity, 20), message: str(x.message, 400) }));
  const todos = rows(r.todos).map((x) => ({ file: str(x.file, 500), line: num(x.line), text: str(x.text, 200) }));
  const finishedAt = str(r.finishedAt, 40);
  return {
    commit: /^[0-9a-f]{7,64}$/i.test(str(r.commit, 64)) ? str(r.commit, 64) : "",
    finishedAt: finishedAt && !Number.isNaN(Date.parse(finishedAt)) ? finishedAt : null,
    tools: {
      gitleaks: bool(tools.gitleaks),
      osv: bool(tools.osv),
      semgrep: bool(tools.semgrep) || EXTRA_TOOLS.some((k) => bool(tools[k])),
      todos: bool(tools.todos),
      extra: EXTRA_TOOLS.filter((k) => bool(tools[k])),
    },
    secrets,
    vulnerabilities,
    findings,
    todos,
    counts: { secrets: secrets.length, vulnerabilities: vulnerabilities.length, findings: findings.length, todos: todos.length },
  };
}

/** Link auf die Stelle im Repository (GitHub). Ohne Commit auf den Standardzweig. */
export function blobUrl(webUrl: string, ref: string, file: string, line: number | null): string | null {
  if (!webUrl || !file || file.includes("..")) return null;
  const path = file.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${webUrl.replace(/\/+$/, "")}/blob/${encodeURIComponent(ref || "HEAD")}/${path}${line ? `#L${line}` : ""}`;
}

/** Wie dringend ist der Bericht? Geheimnisse und Lücken zählen, Befunde und TODOs nicht. */
export const checkIsUrgent = (r: Pick<CheckReport, "counts"> | null | undefined) => Boolean(r && (r.counts.secrets > 0 || r.counts.vulnerabilities > 0));

/** Mehr Geheimnisse oder Lücken als beim letzten Bericht? Dann gibt es eine Benachrichtigung. */
export function checkGotWorse(before: Pick<CheckReport, "counts"> | null, after: Pick<CheckReport, "counts">): boolean {
  return after.counts.secrets > (before?.counts.secrets ?? 0) || after.counts.vulnerabilities > (before?.counts.vulnerabilities ?? 0);
}
