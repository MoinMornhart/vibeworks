// Projekte prüfen (#100): Ist die Dokumentation vollständig, und was ist noch
// offen? Reine Bewertung – die Daten sammelt das MCP-Werkzeug review_projects.

export type ReviewFinding =
  | "noDescription"
  | "shortDescription"
  | "noNotes"
  | "noReadme"
  | "noClaudeMd"
  | "overdueTasks"
  | "blockedTasks"
  | "staleTasks"
  | "doingWithoutAssignee"
  | "syncError"
  | "ciFailing"
  | "progressMismatch";

export interface ProjectFacts {
  description: string | null;
  summary: string | null;
  notes: number;
  /** Dateien im Repository – null, wenn es keine lokale Kopie gibt */
  repoFiles: string[] | null;
  hasRepo: boolean;
  syncError: string | null;
  ciState: string | null;
  progress: number;
  tasks: Array<{ status: string; dueDate: Date | null; updatedAt: Date; assignee: string | null }>;
}

export interface ProjectReview {
  findings: ReviewFinding[];
  open: { todo: number; doing: number; blocked: number; overdue: number; stale: number };
  done: number;
  /** 0–100: grob, wie vollständig Doku und Aufgaben gepflegt sind */
  score: number;
}

const STALE_MS = 14 * 24 * 60 * 60_000;
const hasFile = (files: string[], name: string) => files.some((f) => f.toLowerCase() === name.toLowerCase() || f.toLowerCase().endsWith(`/${name.toLowerCase()}`));

export function reviewProject(p: ProjectFacts, now = Date.now()): ProjectReview {
  const findings: ReviewFinding[] = [];
  const description = (p.description ?? "").trim();
  if (!description && !(p.summary ?? "").trim()) findings.push("noDescription");
  else if (description.length > 0 && description.length < 40) findings.push("shortDescription");
  if (p.notes === 0) findings.push("noNotes");
  if (p.repoFiles) {
    if (!p.repoFiles.some((f) => /^readme(\.\w+)?$/i.test(f))) findings.push("noReadme");
    if (!hasFile(p.repoFiles, "CLAUDE.md") && !hasFile(p.repoFiles, "AGENTS.md")) findings.push("noClaudeMd");
  }
  if (p.hasRepo && p.syncError) findings.push("syncError");
  if (p.ciState === "failure") findings.push("ciFailing");

  const open = { todo: 0, doing: 0, blocked: 0, overdue: 0, stale: 0 };
  let done = 0;
  let doingNoAssignee = 0;
  for (const t of p.tasks) {
    if (t.status === "DONE") {
      done++;
      continue;
    }
    if (t.status === "TODO") open.todo++;
    if (t.status === "DOING") {
      open.doing++;
      if (!t.assignee) doingNoAssignee++;
    }
    if (t.status === "BLOCKED") open.blocked++;
    if (t.dueDate && t.dueDate.getTime() < now) open.overdue++;
    if (now - t.updatedAt.getTime() > STALE_MS) open.stale++;
  }
  if (open.overdue) findings.push("overdueTasks");
  if (open.blocked) findings.push("blockedTasks");
  if (open.stale) findings.push("staleTasks");
  if (doingNoAssignee) findings.push("doingWithoutAssignee");
  const total = p.tasks.length;
  // Fortschritt passt nicht zu den Aufgaben (mehr als 30 Punkte daneben)
  if (total >= 3 && Math.abs(Math.round((done / total) * 100) - p.progress) > 30) findings.push("progressMismatch");

  const weights: Partial<Record<ReviewFinding, number>> = { noDescription: 25, shortDescription: 10, noNotes: 10, noReadme: 15, noClaudeMd: 10, syncError: 15, ciFailing: 10, overdueTasks: 10, blockedTasks: 5, staleTasks: 5, doingWithoutAssignee: 5, progressMismatch: 5 };
  const score = Math.max(0, 100 - findings.reduce((s, f) => s + (weights[f] ?? 0), 0));
  return { findings, open, done, score };
}

/** Englische Erklärung je Befund – für die KI, mit dem, was zu tun ist. */
export const FINDING_HINTS: Record<ReviewFinding, string> = {
  noDescription: "The project has no description or summary – add one (update_project).",
  shortDescription: "The description is very short – explain goal, stack and status (update_project).",
  noNotes: "No notes yet – document decisions, setup or links as a note (create_note).",
  noReadme: "The repository has no README.",
  noClaudeMd: "The repository has no CLAUDE.md/AGENTS.md – get_claude_md returns a template.",
  overdueTasks: "Some open tasks are overdue – finish them or move the due date (update_task).",
  blockedTasks: "Some tasks are blocked – check the reason in their description.",
  staleTasks: "Some open tasks have not changed for 14 days – update or close them.",
  doingWithoutAssignee: "Tasks in progress without an assignee – set who works on them.",
  syncError: "The repository sync is failing – see get_repo_status.",
  ciFailing: "CI is failing on the main branch – see get_repo_status.",
  progressMismatch: "The project progress doesn't match its tasks – update it (update_project).",
};
