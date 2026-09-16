// Issues, die direkt im Git-System entstehen, als Aufgaben übernehmen (#69).
// Vertraut wird nur, wer im Repository schreiben darf oder im Projekt eine
// Rolle hat (Arbeiter, Bughunter) – sonst könnten Fremde der KI über ein
// Issue Anweisungen unterschieben.

export const ISSUE_IMPORT_MODES = ["off", "trusted", "all"] as const;
export type IssueImportMode = (typeof ISSUE_IMPORT_MODES)[number];
export const GIT_ROLES = ["worker", "bughunter"] as const;
export type GitRole = (typeof GIT_ROLES)[number];
export interface GitPerson {
  login: string;
  role: GitRole;
}

export const MAX_GIT_PEOPLE = 50;
/** Höchstens so viele neue Issues je Abgleich */
export const MAX_IMPORT = 10;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98})$/;

export const isImportMode = (v: unknown): v is IssueImportMode => typeof v === "string" && (ISSUE_IMPORT_MODES as readonly string[]).includes(v);

/** Gespeicherte Personenliste aufräumen: gültige Logins, bekannte Rollen, keine Doppelten. */
export function normalizeGitPeople(input: unknown): GitPerson[] {
  const out: GitPerson[] = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const login = typeof p.login === "string" ? p.login.trim().replace(/^@/, "") : "";
    if (!LOGIN.test(login) || !(GIT_ROLES as readonly unknown[]).includes(p.role)) continue;
    if (out.some((x) => x.login.toLowerCase() === login.toLowerCase())) continue;
    out.push({ login, role: p.role as GitRole });
    if (out.length >= MAX_GIT_PEOPLE) break;
  }
  return out;
}

export const roleOf = (people: GitPerson[], login: string): GitRole | null =>
  people.find((p) => p.login.toLowerCase() === login.toLowerCase())?.role ?? null;

/** Darf das Konto dem Bot Befehle geben bzw. gilt sein Issue als vertrauenswürdig? */
export const trustedAuthor = (permission: string | null, role: GitRole | null) =>
  role !== null || permission === "admin" || permission === "maintain" || permission === "write";

/** Was mit dem Issue passiert: überspringen, übernehmen oder gesperrt (nur für Menschen sichtbar) übernehmen. */
export function importDecision(mode: IssueImportMode, trusted: boolean): "skip" | "import" | "locked" {
  if (mode === "off") return "skip";
  if (trusted) return "import";
  return mode === "all" ? "locked" : "skip";
}

/** Issue von VibeWorks selbst? (Marke im Text) */
export const fromVibeWorks = (body: string | null | undefined) => Boolean(body?.includes("<!-- vibeworks:task:"));

const STATUS_AND_WORKER = /^(in arbeit|blockiert|🤖|👤)/iu;

export interface ImportableIssue {
  number: number;
  url: string;
  title: string;
  body: string | null;
  author: string;
  labels: string[];
}

export interface ImportedTaskData {
  title: string;
  description: string | null;
  labels: string[];
  priority: number;
  aiLocked: boolean;
  createdByName: string;
  issueNumber: number;
  issueUrl: string;
}

export function taskFromIssue(issue: ImportableIssue, role: GitRole | null, locked: boolean): ImportedTaskData {
  const labels = issue.labels.filter((l) => !STATUS_AND_WORKER.test(l.trim())).map((l) => l.trim().slice(0, 40));
  if (role === "bughunter" && !labels.some((l) => l.toLowerCase() === "bug")) labels.push("bug");
  if (locked) labels.push("extern");
  const body = issue.body?.trim() ?? "";
  return {
    title: (issue.title.trim() || `Issue #${issue.number}`).slice(0, 200),
    description: [`> Aus GitHub übernommen: ${issue.url} – von @${issue.author}${role ? ` (${role === "bughunter" ? "Bughunter" : "Arbeiter"})` : ""}`, body].filter(Boolean).join("\n\n").slice(0, 20_000),
    labels: [...new Set(labels)].slice(0, 20),
    priority: role === "bughunter" ? 3 : 2,
    aiLocked: locked,
    createdByName: `@${issue.author}`.slice(0, 80),
    issueNumber: issue.number,
    issueUrl: issue.url,
  };
}
