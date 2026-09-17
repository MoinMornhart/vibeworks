import { z } from "zod";
import { slugify } from "./utils";

// KI-Workflows (#101): Checklisten, die eine KI Schritt für Schritt abarbeitet.
// VibeWorks bringt einige mit, eigene legt man je Projekt an (oder die KI).
// Startet die KI einen Workflow, bekommt sie jeden Schritt samt Prüfung und
// bis zum Ende bei jedem Werkzeugaufruf einen Hinweis. Ohne Datenbank.

export interface WorkflowStep {
  title: string;
  /** Woran man merkt, dass der Schritt wirklich erledigt ist */
  check: string;
}

type L = { de: string; en: string };

export interface BuiltinWorkflow {
  key: string;
  title: L;
  description: L;
  steps: Array<{ de: WorkflowStep; en: WorkflowStep }>;
}

const step = (en: WorkflowStep, de: WorkflowStep) => ({ en, de });

const TASK_START = step(
  { title: "Find or create the VibeWorks task and set it to DOING with your name as assignee", check: "get_task shows status DOING and your name as assignee" },
  { title: "VibeWorks-Aufgabe finden oder anlegen und mit deinem Namen auf DOING setzen", check: "get_task zeigt DOING und deinen Namen als Bearbeiter" },
);
const READ_STRUCTURE = step(
  { title: "Read the project structure (get_project_structure) and the code graph of every file you will touch", check: "You can name the files you will change and who imports them – from tool results, not from memory" },
  { title: "Projektaufbau (get_project_structure) und Code-Netz jeder Datei lesen, die du anfasst", check: "Du kannst die betroffenen Dateien und ihre Nutzer nennen – aus Werkzeug-Ergebnissen, nicht aus dem Gedächtnis" },
);
const VERIFY = step(
  { title: "Verify: run type check, tests and build, and try the change for real", check: "All commands passed and you saw the result yourself – paste the key output as evidence" },
  { title: "Prüfen: Typprüfung, Tests und Build ausführen und die Änderung wirklich ausprobieren", check: "Alle Befehle grün, Ergebnis selbst gesehen – die wichtigste Ausgabe als Beleg angeben" },
);
const DOCS = step(
  { title: "Update the docs: project structure table (update_project_structure), README and the AI instruction file your tools read (CLAUDE.md, AGENTS.md, GEMINI.md …) if behaviour changed, memos for pitfalls", check: "get_project_structure matches the code; nothing you changed is undocumented" },
  { title: "Doku nachziehen: Projektaufbau (update_project_structure), README und die KI-Anleitung, die eure Werkzeuge lesen (CLAUDE.md, AGENTS.md, GEMINI.md …), bei geändertem Verhalten, Memos zu Stolperstellen", check: "get_project_structure passt zum Code; nichts Geändertes ist undokumentiert" },
);
const FINAL = step(
  { title: "Final review: re-read the original request and compare it with what you did, then set the task DONE with a short summary", check: "Every point of the request is covered, nothing is invented or left half-done, open questions are written down" },
  { title: "Abschluss: ursprüngliche Anfrage noch einmal lesen, mit dem Ergebnis vergleichen, dann Aufgabe mit kurzer Zusammenfassung auf DONE", check: "Jeder Punkt der Anfrage erledigt, nichts erfunden oder halb fertig, offene Fragen notiert" },
);

export const BUILTIN_WORKFLOWS: BuiltinWorkflow[] = [
  {
    key: "feature",
    title: { de: "Feature umsetzen", en: "Build a feature" },
    description: { de: "Vom Wunsch bis zur geprüften, dokumentierten Änderung.", en: "From request to a verified, documented change." },
    steps: [
      TASK_START,
      READ_STRUCTURE,
      step(
        { title: "Plan the change in a few bullet points; ask the user if anything is ambiguous", check: "The plan names files and steps; no open assumption is silently decided" },
        { title: "Änderung in wenigen Punkten planen; bei Unklarheiten den Nutzer fragen", check: "Plan nennt Dateien und Schritte; keine offene Annahme still entschieden" },
      ),
      step(
        { title: "Implement it in the style of the surrounding code", check: "Only the planned files changed; no leftover debug code or TODOs" },
        { title: "Umsetzen im Stil des umgebenden Codes", check: "Nur geplante Dateien geändert; keine Debug-Reste oder TODOs" },
      ),
      VERIFY,
      DOCS,
      FINAL,
    ],
  },
  {
    key: "bugfix",
    title: { de: "Fehler beheben", en: "Fix a bug" },
    description: { de: "Ursache finden statt Symptome überdecken – mit Test als Beleg.", en: "Find the cause instead of hiding symptoms – with a test as proof." },
    steps: [
      TASK_START,
      step(
        { title: "Reproduce the bug (list_errors for stack traces, search_code for the code)", check: "You can describe exact steps or input that trigger it" },
        { title: "Fehler nachstellen (list_errors für Stacktraces, search_code für den Code)", check: "Genaue Schritte oder Eingaben, die ihn auslösen, sind bekannt" },
      ),
      step(
        { title: "Find the root cause and write a test that fails because of it", check: "The new test fails before the fix" },
        { title: "Ursache finden und einen Test schreiben, der deswegen fehlschlägt", check: "Der neue Test schlägt vor dem Fix fehl" },
      ),
      step(
        { title: "Fix the cause, not the symptom", check: "The new test passes; the fix explains why the bug happened" },
        { title: "Ursache beheben, nicht das Symptom", check: "Der neue Test ist grün; der Fix erklärt, warum der Fehler auftrat" },
      ),
      VERIFY,
      step(
        { title: "Mark fixed app errors with resolve_error and pin what you learned with add_code_memo", check: "list_errors no longer shows the error as open" },
        { title: "Behobene App-Fehler mit resolve_error markieren, Erkenntnis mit add_code_memo anheften", check: "list_errors zeigt den Fehler nicht mehr als offen" },
      ),
      FINAL,
    ],
  },
  {
    key: "release",
    title: { de: "Release vorbereiten", en: "Prepare a release" },
    description: { de: "Nichts vergessen zwischen „fertig“ und „ausgeliefert“.", en: "Nothing forgotten between “done” and “shipped”." },
    steps: [
      step(
        { title: "Check open work: list_tasks and list_problems for this project", check: "No task meant for this release is still open; known problems are listed for the user" },
        { title: "Offenes prüfen: list_tasks und list_problems für das Projekt", check: "Keine Aufgabe für dieses Release ist offen; bekannte Probleme sind dem Nutzer genannt" },
      ),
      VERIFY,
      step(
        { title: "Bump the version and write the changelog the way the project does it", check: "Version and changelog match and describe every user-visible change" },
        { title: "Version erhöhen und Changelog so schreiben, wie das Projekt es macht", check: "Version und Changelog passen zusammen und nennen jede sichtbare Änderung" },
      ),
      step(
        { title: "Commit and push, then watch CI (get_repo_status)", check: "CI on the main branch is green" },
        { title: "Committen und pushen, dann CI beobachten (get_repo_status)", check: "CI auf dem Hauptzweig ist grün" },
      ),
      DOCS,
      FINAL,
    ],
  },
  {
    key: "review",
    title: { de: "Projekt durchsehen", en: "Review the project" },
    description: { de: "Doku, Aufgaben und Probleme prüfen und daraus Aufgaben machen.", en: "Check docs, tasks and problems and turn findings into tasks." },
    steps: [
      step(
        { title: "Run review_projects and get_repo_status for the project", check: "You have the score, findings and repository state from the tools" },
        { title: "review_projects und get_repo_status für das Projekt ausführen", check: "Bewertung, Befunde und Repository-Stand liegen aus den Werkzeugen vor" },
      ),
      step(
        { title: "Compare the project structure table with list_code_files", check: "get_project_structure reports no missing paths and no important folder is undocumented" },
        { title: "Projektaufbau mit list_code_files abgleichen", check: "get_project_structure meldet keine fehlenden Pfade, kein wichtiger Ordner ist undokumentiert" },
      ),
      step(
        { title: "Create one task per real finding (create_task) – check for duplicates first", check: "Every finding has exactly one task; nothing was created twice" },
        { title: "Je echtem Befund eine Aufgabe anlegen (create_task) – vorher auf Doppelte prüfen", check: "Jeder Befund hat genau eine Aufgabe; nichts doppelt angelegt" },
      ),
      step(
        { title: "Summarise the result for the user in a note (create_note)", check: "The note lists findings, created tasks and what is fine" },
        { title: "Ergebnis für den Nutzer als Notiz festhalten (create_note)", check: "Die Notiz nennt Befunde, angelegte Aufgaben und was in Ordnung ist" },
      ),
    ],
  },
  {
    key: "structure",
    title: { de: "Projektaufbau pflegen", en: "Maintain the project structure" },
    description: { de: "Die Aufbau-Tabelle aus dem echten Code anlegen oder aktualisieren.", en: "Create or update the structure table from the real code." },
    steps: [
      step(
        { title: "Call get_project_structure and list_code_files", check: "You have the current table, suggested areas and the file list" },
        { title: "get_project_structure und list_code_files aufrufen", check: "Aktuelle Tabelle, vorgeschlagene Bereiche und Dateiliste liegen vor" },
      ),
      step(
        { title: "Read the entry points of each area (get_code_graph, search_code) before describing it", check: "Each description is based on code you actually read" },
        { title: "Einstiegsdateien jedes Bereichs lesen (get_code_graph, search_code), bevor du ihn beschreibst", check: "Jede Beschreibung beruht auf Code, den du wirklich gelesen hast" },
      ),
      step(
        { title: "Save the table with update_project_structure: one row per area with real path, purpose and how it works", check: "The tool reports no missing paths" },
        { title: "Tabelle mit update_project_structure speichern: je Bereich eine Zeile mit echtem Pfad, Zweck und Funktionsweise", check: "Das Werkzeug meldet keine fehlenden Pfade" },
      ),
      FINAL,
    ],
  },
];

export const builtinWorkflow = (key: string) => BUILTIN_WORKFLOWS.find((w) => w.key === key) ?? null;

/** So beschreibt man einen Workflow gut – für die KI (englisch). */
export const WORKFLOW_GUIDE =
  "Write a workflow as 3–12 steps. Each step: one imperative action in the title (\"Run the tests\", not \"Tests\"), plus a check that says how to prove it is done (a command result, a tool result, something visible). Put task handling first (DOING with your name) and a final review last. Write titles and checks in the user's language.";

export const workflowStepSchema = z.object({
  title: z.string().trim().min(3).max(200),
  check: z.string().trim().max(300).default(""),
});

export const workflowSaveSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(""),
  steps: z.array(workflowStepSchema).min(1).max(20),
});
export type WorkflowSave = z.infer<typeof workflowSaveSchema>;

/** Schlüssel eines eigenen Workflows – nie gleich einem mitgelieferten. */
export function workflowKeyFor(title: string, taken: string[]): string {
  // slugify füllt Leeres mit einem eigenen Ersatz – hier soll es „workflow“ heißen
  const base = (/[\p{L}\p{N}]/u.test(title) ? slugify(title).slice(0, 40) : "") || "workflow";
  const used = new Set([...taken, ...BUILTIN_WORKFLOWS.map((w) => w.key)]);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const readSteps = (raw: unknown): WorkflowStep[] =>
  Array.isArray(raw)
    ? raw.flatMap((s) => {
        const parsed = workflowStepSchema.safeParse(s);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

// ── Durchläufe ──────────────────────────────────────────────

export interface StepResult {
  step: number;
  status: "done" | "skipped";
  note: string;
  at: string;
}

export const readResults = (raw: unknown): StepResult[] =>
  Array.isArray(raw)
    ? raw.filter((r): r is StepResult => Boolean(r) && typeof r === "object" && typeof r.step === "number" && (r.status === "done" || r.status === "skipped"))
    : [];

/** Nächster offener Schritt (1-basiert) oder null, wenn alle erledigt sind. */
export function nextOpenStep(steps: WorkflowStep[], results: StepResult[]): number | null {
  const handled = new Set(results.map((r) => r.step));
  for (let i = 1; i <= steps.length; i++) if (!handled.has(i)) return i;
  return null;
}

export class StepError extends Error {}

/**
 * Ergebnis eines Schritts eintragen. Die Reihenfolge ist fest – so kann die KI
 * nichts überspringen, ohne es mit Grund als „skipped“ zu markieren.
 */
export function applyStep(steps: WorkflowStep[], results: StepResult[], step: number, status: "done" | "skipped", note: string, now = new Date()): StepResult[] {
  const next = nextOpenStep(steps, results);
  if (next === null) throw new StepError("All steps of this run are already handled.");
  if (step !== next) throw new StepError(`Step ${step} is not next – step ${next} ("${steps[next - 1].title}") comes first. Finish it, or mark it skipped with a reason.`);
  const text = note.trim();
  if (status === "done" && text.length < 10) throw new StepError("Describe what you did and how you verified it (at least 10 characters) – that is the evidence for this step.");
  if (status === "skipped" && text.length < 10) throw new StepError("Give a reason why this step is skipped (at least 10 characters).");
  return [...results, { step, status, note: text.slice(0, 2000), at: now.toISOString() }];
}

/** Ohne Aktivität so lange her – dann erinnert VibeWorks nicht mehr daran. */
export const RUN_STALE_MS = 12 * 60 * 60_000;

export const stepText = (steps: WorkflowStep[], n: number) => {
  const s = steps[n - 1];
  return `Step ${n}/${steps.length}: ${s.title}${s.check ? ` – Check: ${s.check}` : ""}`;
};

/** Hinweis für die KI, solange ein Durchlauf offen ist. */
export function runNotice(run: { id: string; title: string; steps: WorkflowStep[]; results: StepResult[] }): string | null {
  const next = nextOpenStep(run.steps, run.results);
  if (next === null) return null;
  return `VibeWorks workflow "${run.title}" (run ${run.id}) is in progress. ${stepText(run.steps, next)}. When it is really done, call complete_workflow_step with run "${run.id}", step ${next} and what you did as evidence. Don't claim the work is finished before all steps are handled.`;
}

/** Was vor „fertig“ immer gilt – englisch, für die KI. */
export const VERIFY_BEFORE_DONE = [
  "Re-read the original request and check every point against what you actually did.",
  "Only report what tool results or command output showed you – never assume a command passed.",
  "Run type check, tests and build (or the project's equivalent) after your last change.",
  "Look for leftovers: debug output, TODOs, commented-out code, unused files.",
  "Update the VibeWorks task (DONE with a short summary, or BLOCKED with the reason) and the project structure if files moved.",
  "Tell the user what is still open or uncertain instead of hiding it.",
];
