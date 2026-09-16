import type { Prisma, WorkflowRun } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireProject } from "@/lib/access";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import {
  applyStep,
  BUILTIN_WORKFLOWS,
  builtinWorkflow,
  nextOpenStep,
  readResults,
  readSteps,
  RUN_STALE_MS,
  runNotice,
  StepError,
  workflowKeyFor,
  type WorkflowSave,
  type WorkflowStep,
} from "@/lib/aiWorkflowLogic";

// KI-Workflows (#101) mit Datenbank: mitgelieferte und eigene zusammenführen,
// Durchläufe starten, Schritte abhaken, Hinweise für den API-Schlüssel.

export interface WorkflowView {
  key: string;
  id: string | null;
  title: string;
  description: string;
  steps: WorkflowStep[];
  builtin: boolean;
  authorName: string | null;
}

/** Mitgelieferte (in der gewünschten Sprache – für die KI englisch) und eigene Workflows eines Projekts. */
export async function workflowsFor(projectId: string, lang: Locale): Promise<WorkflowView[]> {
  const own = await db.aiWorkflow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  return [
    ...BUILTIN_WORKFLOWS.map((w) => ({
      key: w.key,
      id: null,
      title: w.title[lang],
      description: w.description[lang],
      steps: w.steps.map((s) => s[lang]),
      builtin: true,
      authorName: null,
    })),
    ...own.map((w) => ({ key: w.key, id: w.id, title: w.title, description: w.description, steps: readSteps(w.steps), builtin: false, authorName: w.authorName })),
  ];
}

export async function findWorkflow(projectId: string, value: string, lang: Locale): Promise<WorkflowView> {
  const v = value.trim().toLowerCase();
  const all = await workflowsFor(projectId, lang);
  const hit = all.find((w) => w.key === v || w.id === value.trim()) ?? all.find((w) => w.title.toLowerCase() === v);
  if (!hit) throw new ApiError(404, `Workflow not found. Available: ${all.map((w) => w.key).join(", ")}`);
  return hit;
}

export async function saveWorkflow(projectId: string, input: WorkflowSave, opts: { key?: string; authorName: string; via: "web" | "mcp" }) {
  if (opts.key && builtinWorkflow(opts.key)) throw new ApiError(400, "Built-in workflows can't be changed – save your own copy under a new title.");
  const data = { title: input.title, description: input.description, steps: input.steps as unknown as Prisma.InputJsonValue };
  if (opts.key) {
    const current = await db.aiWorkflow.findUnique({ where: { projectId_key: { projectId, key: opts.key } } });
    if (!current) throw new ApiError(404, "Workflow not found.");
    return db.aiWorkflow.update({ where: { id: current.id }, data });
  }
  const count = await db.aiWorkflow.count({ where: { projectId } });
  if (count >= 30) throw new ApiError(400, "At most 30 own workflows per project.");
  const taken = (await db.aiWorkflow.findMany({ where: { projectId }, select: { key: true } })).map((w) => w.key);
  return db.aiWorkflow.create({ data: { ...data, projectId, key: workflowKeyFor(input.title, taken), authorName: opts.authorName, via: opts.via } });
}

export function serializeRun(r: WorkflowRun) {
  const steps = readSteps(r.steps);
  const results = readResults(r.results);
  const next = r.status === "running" ? nextOpenStep(steps, results) : null;
  return {
    id: r.id,
    workflow: r.workflowKey,
    title: r.title,
    status: r.status,
    taskId: r.taskId,
    steps: steps.map((s, i) => {
      const res = results.find((x) => x.step === i + 1);
      return { n: i + 1, ...s, status: res?.status ?? (next === i + 1 ? ("current" as const) : ("open" as const)), note: res?.note ?? null };
    }),
    done: results.length,
    total: steps.length,
    summary: r.summary,
    startedAt: r.startedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}
export type RunView = ReturnType<typeof serializeRun>;

/** Workflows in der Sprache der Oberfläche und die letzten Durchläufe – für die Projektseite. */
export async function workflowPayload(projectId: string) {
  const [workflows, runs] = await Promise.all([
    workflowsFor(projectId, await getLocale()),
    db.workflowRun.findMany({ where: { projectId }, orderBy: { startedAt: "desc" }, take: 15 }),
  ]);
  return { workflows, runs: runs.map(serializeRun) };
}
export type WorkflowPayload = Awaited<ReturnType<typeof workflowPayload>>;

export async function startRun(opts: { userId: string; tokenId: string | null; projectId: string; workflow: WorkflowView; taskId: string | null }) {
  if (!opts.workflow.steps.length) throw new ApiError(400, "This workflow has no steps.");
  // Derselbe Workflow läuft für diesen Schlüssel schon? Dann weiter dort statt doppelt.
  const open = await db.workflowRun.findFirst({
    where: { projectId: opts.projectId, workflowKey: opts.workflow.key, status: "running", userId: opts.userId, tokenId: opts.tokenId, taskId: opts.taskId },
  });
  if (open) return { run: open, resumed: true };
  const run = await db.workflowRun.create({
    data: {
      projectId: opts.projectId,
      userId: opts.userId,
      tokenId: opts.tokenId,
      taskId: opts.taskId,
      workflowKey: opts.workflow.key,
      title: opts.workflow.title,
      steps: opts.workflow.steps as unknown as Prisma.InputJsonValue,
    },
  });
  return { run, resumed: false };
}

/** Durchlauf laden – nur mit Recht „Aufgaben bearbeiten“ im Projekt. */
export async function requireRun(userId: string, runId: string) {
  const run = await db.workflowRun.findUnique({ where: { id: runId } });
  if (!run) throw new ApiError(404, "Workflow run not found.");
  await requireProject(userId, run.projectId, "tasks.edit");
  return run;
}

export async function completeStep(userId: string, runId: string, step: number, status: "done" | "skipped", note: string) {
  const run = await requireRun(userId, runId);
  if (run.status !== "running") throw new ApiError(400, `This run is ${run.status}.`);
  const steps = readSteps(run.steps);
  let results;
  try {
    results = applyStep(steps, readResults(run.results), step, status, note);
  } catch (err) {
    if (err instanceof StepError) throw new ApiError(400, err.message);
    throw err;
  }
  const finished = nextOpenStep(steps, results) === null;
  return db.workflowRun.update({
    where: { id: run.id },
    data: { results: results as unknown as Prisma.InputJsonValue, ...(finished ? { status: "done", finishedAt: new Date() } : {}) },
  });
}

export async function cancelRun(userId: string, runId: string, reason: string | null) {
  const run = await requireRun(userId, runId);
  if (run.status !== "running") return run;
  return db.workflowRun.update({ where: { id: run.id }, data: { status: "cancelled", summary: reason, finishedAt: new Date() } });
}

/** Hinweis auf offene Durchläufe dieses Schlüssels – höchstens zwei, veraltete nicht. */
export async function runNoticeFor(tokenId: string): Promise<string | null> {
  const runs = await db.workflowRun.findMany({
    where: { tokenId, status: "running", updatedAt: { gte: new Date(Date.now() - RUN_STALE_MS) } },
    orderBy: { updatedAt: "desc" },
    take: 2,
  });
  const notes = runs.map((r) => runNotice({ id: r.id, title: r.title, steps: readSteps(r.steps), results: readResults(r.results) })).filter(Boolean);
  return notes.length ? notes.join("\n") : null;
}
