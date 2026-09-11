import type { ProjectStatus, TaskStatus } from "@prisma/client";

// Automatischer Fortschritt: eine nachvollziehbare Analyse statt eines
// Reglers. Drei Signale – Aufgaben, Entwicklung (Commits, CI) und Planung
// (Beschreibung, Notizen) – der Status setzt den Rahmen: eine Idee kommt
// höchstens auf 10 %, 100 % gibt es erst mit „Fertig“.
// Ohne Datenbank – für Server, Oberfläche und Tests.

type CiLike = "success" | "failure" | "running" | "pending" | "canceled" | string;

export interface ProgressInput {
  status: ProjectStatus;
  tasks: Record<TaskStatus, number>;
  repo: { commits: number; ci: CiLike | null } | null;
  planning: { description: number; summary: boolean; notes: number };
}

export type ProgressPartKey = "tasks" | "development" | "planning";

export interface ProgressPart {
  key: ProgressPartKey;
  available: boolean;
  /** Bewertung 0–1 */
  score: number;
  /** Beitrag in Prozentpunkten */
  points: number;
}

export interface ProgressAnalysis {
  progress: number;
  status: ProjectStatus;
  /** Obergrenze durch den Status – null, wenn sie nicht gegriffen hat */
  cappedAt: number | null;
  parts: ProgressPart[];
  facts: {
    tasks: Record<TaskStatus, number> & { total: number };
    commits: number | null;
    ci: CiLike | null;
    description: "none" | "short" | "good";
    notes: number;
  };
}

/**
 * Rahmen je Status: Sockel, Punkte für Planung und für die Arbeit, Obergrenze.
 * Gerechnet wird überall gleich – der Status kappt nur. So bleibt sichtbar,
 * dass z. B. eine Idee mit halb erledigten Aufgaben nur am Status hängt.
 */
const PHASE: Record<Exclude<ProjectStatus, "DONE">, { base: number; planning: number; work: number; max: number }> = {
  IDEA: { base: 0, planning: 10, work: 85, max: 10 },
  PLANNING: { base: 5, planning: 10, work: 85, max: 25 },
  OPEN: { base: 0, planning: 10, work: 85, max: 95 },
  IN_PROGRESS: { base: 0, planning: 10, work: 85, max: 95 },
  ARCHIVED: { base: 0, planning: 10, work: 90, max: 100 },
};

/** Gewichte innerhalb der Arbeit – fehlt ein Signal, trägt das andere allein. */
const WORK_WEIGHT = { tasks: 0.7, development: 0.3 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function descriptionLevel(length: number): "none" | "short" | "good" {
  return length >= 400 ? "good" : length > 0 ? "short" : "none";
}

export function analyzeProgress(input: ProgressInput): ProgressAnalysis {
  const t = input.tasks;
  const total = t.TODO + t.DOING + t.BLOCKED + t.DONE;
  const desc = descriptionLevel(input.planning.description);
  const facts: ProgressAnalysis["facts"] = {
    tasks: { ...t, total },
    commits: input.repo?.commits ?? null,
    ci: input.repo?.ci ?? null,
    description: desc,
    notes: input.planning.notes,
  };

  // Aufgaben: erledigt zählt voll, in Arbeit halb, blockiert ein Viertel
  const tasksScore = total ? clamp01((t.DONE + 0.5 * t.DOING + 0.25 * t.BLOCKED) / total) : 0;
  // Entwicklung: Umfang der Commit-Historie (ab 40 voll) und der CI-Zustand
  const ci = input.repo?.ci;
  const devScore = input.repo ? clamp01(Math.min(input.repo.commits / 40, 1) * 0.8 + (ci === "success" ? 0.2 : ci === "failure" ? 0 : 0.1)) : 0;
  // Planung: Beschreibung, Kurzbeschreibung, Notizen
  const planScore = clamp01(
    (desc === "good" ? 0.6 : desc === "short" ? 0.3 : 0) + (input.planning.summary ? 0.1 : 0) + (Math.min(input.planning.notes, 3) / 3) * 0.3,
  );

  if (input.status === "DONE") {
    return {
      progress: 100,
      status: input.status,
      cappedAt: null,
      facts,
      parts: [
        { key: "tasks", available: total > 0, score: tasksScore, points: 0 },
        { key: "development", available: Boolean(input.repo), score: devScore, points: 0 },
        { key: "planning", available: true, score: planScore, points: 0 },
      ],
    };
  }

  const phase = PHASE[input.status];
  const hasTasks = total > 0;
  const hasRepo = Boolean(input.repo);
  const weightSum = (hasTasks ? WORK_WEIGHT.tasks : 0) + (hasRepo ? WORK_WEIGHT.development : 0);
  const share = (w: number, on: boolean) => (on && weightSum ? w / weightSum : 0);

  const parts: ProgressPart[] = [
    { key: "tasks", available: hasTasks, score: tasksScore, points: phase.work * share(WORK_WEIGHT.tasks, hasTasks) * tasksScore },
    { key: "development", available: hasRepo, score: devScore, points: phase.work * share(WORK_WEIGHT.development, hasRepo) * devScore },
    { key: "planning", available: true, score: planScore, points: phase.planning * planScore },
  ];
  const raw = phase.base + parts.reduce((sum, p) => sum + p.points, 0);
  const progress = Math.round(Math.min(raw, phase.max));
  return {
    progress,
    status: input.status,
    cappedAt: raw > phase.max + 0.5 ? phase.max : null,
    facts,
    parts: parts.map((p) => ({ ...p, points: Math.round(p.points) })),
  };
}

/** Eingabe aus Datenbank-Werten bauen (RepoCache.commits/ci sind JSON). */
export function progressInput(p: {
  status: ProjectStatus;
  summary: string | null;
  description: string | null;
  notes: number;
  tasks: Partial<Record<TaskStatus, number>>;
  repoUrl: string | null;
  repoCache: { commits: unknown; ci: unknown } | null;
}): ProgressInput {
  const commits = Array.isArray(p.repoCache?.commits) ? p.repoCache.commits.length : 0;
  const ci = (p.repoCache?.ci as { state?: string } | null)?.state ?? null;
  return {
    status: p.status,
    tasks: { TODO: p.tasks.TODO ?? 0, DOING: p.tasks.DOING ?? 0, BLOCKED: p.tasks.BLOCKED ?? 0, DONE: p.tasks.DONE ?? 0 },
    repo: p.repoUrl ? { commits, ci } : null,
    planning: { description: p.description?.trim().length ?? 0, summary: Boolean(p.summary?.trim()), notes: p.notes },
  };
}
