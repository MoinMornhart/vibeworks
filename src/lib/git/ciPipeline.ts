import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { decrypt, sha256 } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { apiBase, authHeaders, GitError, request, requestText } from "./providers";
import { listFilesViaGit, localHeadViaGit, readFileViaGit } from "./gitCli";
import {
  buildCiWorkflow,
  CI_FILE,
  CI_MARKER,
  CI_PATH,
  ciPipelineSchema,
  duplicateNames,
  nodeStates,
  suggestPipeline,
  type CiPipeline,
  type GhStep,
  type NodeState,
} from "./ciPipelineLogic";

// CI-Designer (#107) mit Datenbank und GitHub: Pipeline speichern, als
// Workflow ins Repository schreiben (nur die eigene Datei), starten und den
// laufenden Durchlauf je Block abfragen. Geht über den Git-Zugang des Projekts
// (Token braucht das Recht „workflow“).

async function project(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, ciPipeline: true, ciPublishedAt: true, ciPublishedBy: true, ciPublishedHash: true, repoCache: { select: { provider: true, defaultBranch: true } } },
  });
}

async function github(p: NonNullable<Awaited<ReturnType<typeof project>>>) {
  if (!p.repoUrl || p.repoCache?.provider !== "github") return null;
  const parsed = parseRepoUrl(p.repoUrl);
  if (!parsed) return null;
  const stored = await tokenCipherFor(p);
  let token: string | null = null;
  try {
    token = stored ? decrypt(stored.cipher) : null;
  } catch {
    token = null;
  }
  return { api: apiBase("github", parsed), headers: authHeaders("github", token), hasToken: Boolean(token), branch: p.repoCache.defaultBranch };
}

const readPipeline = (raw: unknown): CiPipeline | null => {
  const parsed = ciPipelineSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/** Dateien und npm-Skripte fürs Vorschlagen – lokale Kopie, sonst die Wurzel über die API. */
async function repoHints(projectId: string, gh: Awaited<ReturnType<typeof github>>, branch: string | null): Promise<{ files: string[]; scripts: string[] }> {
  const scriptsOf = (text: string | null) => {
    try {
      return Object.keys((JSON.parse(text ?? "{}") as { scripts?: Record<string, string> }).scripts ?? {});
    } catch {
      return [];
    }
  };
  if (branch && (await localHeadViaGit(projectId, branch))) {
    return { files: await listFilesViaGit(projectId, branch), scripts: scriptsOf(await readFileViaGit(projectId, branch, "package.json")) };
  }
  if (!gh) return { files: [], scripts: [] };
  try {
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const list = await request<Array<{ name: string; type: string }>>("GET", `${gh.api}/contents${ref}`, gh.headers);
    const files = (list ?? []).filter((f) => f.type === "file").map((f) => f.name);
    const pkg = files.includes("package.json") ? await requestText(`${gh.api}/contents/package.json${ref}`, { ...gh.headers, Accept: "application/vnd.github.raw+json" }).catch(() => null) : null;
    return { files, scripts: scriptsOf(pkg) };
  } catch {
    return { files: [], scripts: [] };
  }
}

export async function ciView(projectId: string) {
  const p = await project(projectId);
  if (!p) throw new ApiError(404, tk("projects", "errors.notFound"));
  const gh = await github(p);
  const saved = readPipeline(p.ciPipeline);
  const branch = p.repoCache?.defaultBranch ?? null;
  const hints = saved ? null : await repoHints(projectId, gh, branch);
  const pipeline = saved ?? suggestPipeline(hints?.files ?? [], branch, hints?.scripts ?? []);
  const yaml = buildCiWorkflow(pipeline, branch);
  return {
    pipeline,
    saved: Boolean(saved),
    // Gespeichert, aber noch nicht (so) im Repository
    unpublished: Boolean(saved) && p.ciPublishedHash !== sha256(yaml),
    supported: Boolean(gh),
    hasToken: gh?.hasToken ?? false,
    defaultBranch: branch,
    publishedAt: p.ciPublishedAt?.toISOString() ?? null,
    publishedBy: p.ciPublishedBy,
    yaml,
    path: CI_PATH,
  };
}
export type CiView = Awaited<ReturnType<typeof ciView>>;

export async function saveCi(projectId: string, raw: unknown) {
  const parsed = ciPipelineSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, `${issue.path.join(".") || "pipeline"}: ${issue.message}`);
  }
  const pipeline = parsed.data;
  const dup = duplicateNames(pipeline);
  if (dup.length) throw new ApiError(400, tk("ci", "errors.duplicate", { names: dup.join(", ") }));
  await db.project.update({ where: { id: projectId }, data: { ciPipeline: pipeline as unknown as Prisma.InputJsonValue } });
  return pipeline;
}

function ghError(err: unknown): never {
  if (err instanceof GitError && (err.status === 403 || err.status === 404)) throw new ApiError(403, tk("ci", "errors.noPermission"));
  if (err instanceof GitError && (err.status === 409 || err.status === 422)) throw new ApiError(409, tk("ci", "errors.rejected"));
  throw new ApiError(502, err instanceof GitError ? err.message : tk("git", "errors.unreachable"));
}

/** Workflow-Datei schreiben – eine fremde Datei gleichen Namens bleibt unangetastet. */
export async function publishCi(projectId: string, by: string) {
  const p = await project(projectId);
  const gh = p ? await github(p) : null;
  if (!p || !gh) throw new ApiError(400, tk("ci", "errors.githubOnly"));
  if (!gh.hasToken) throw new ApiError(400, tk("ci", "errors.noToken"));
  const pipeline = readPipeline(p.ciPipeline);
  if (!pipeline) throw new ApiError(400, tk("ci", "errors.notSaved"));
  const yaml = buildCiWorkflow(pipeline, gh.branch);
  const ref = gh.branch ? `?ref=${encodeURIComponent(gh.branch)}` : "";
  let current: { sha: string; text: string } | null = null;
  try {
    const file = await request<{ sha: string; content?: string }>("GET", `${gh.api}/contents/${CI_PATH}${ref}`, gh.headers);
    current = { sha: file.sha, text: Buffer.from(file.content ?? "", "base64").toString("utf8") };
  } catch (err) {
    if (!(err instanceof GitError && err.status === 404)) ghError(err);
  }
  if (current && !current.text.startsWith(CI_MARKER)) throw new ApiError(409, tk("ci", "errors.foreignFile", { path: CI_PATH }));
  let result: "created" | "updated" | "current" = "current";
  if (current?.text !== yaml) {
    try {
      await request("PUT", `${gh.api}/contents/${CI_PATH}`, gh.headers, {
        message: current ? "VibeWorks: CI-Pipeline aktualisieren" : "VibeWorks: CI-Pipeline einrichten",
        content: Buffer.from(yaml, "utf8").toString("base64"),
        ...(current ? { sha: current.sha } : {}),
        ...(gh.branch ? { branch: gh.branch } : {}),
      });
    } catch (err) {
      ghError(err);
    }
    result = current ? "updated" : "created";
  }
  await db.project.update({ where: { id: projectId }, data: { ciPublishedAt: new Date(), ciPublishedBy: by, ciPublishedHash: sha256(yaml) } });
  return result;
}

/** Durchlauf von Hand starten (workflow_dispatch). */
export async function runCi(projectId: string) {
  const p = await project(projectId);
  const gh = p ? await github(p) : null;
  if (!p || !gh) throw new ApiError(400, tk("ci", "errors.githubOnly"));
  const pipeline = readPipeline(p.ciPipeline);
  if (!p.ciPublishedAt || !pipeline) throw new ApiError(400, tk("ci", "errors.notPublished"));
  if (!pipeline.triggers.manual) throw new ApiError(400, tk("ci", "errors.noManual"));
  try {
    await request("POST", `${gh.api}/actions/workflows/${CI_FILE}/dispatches`, gh.headers, { ref: gh.branch ?? "main" });
  } catch (err) {
    ghError(err);
  }
}

interface GhRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string | null;
  event: string;
  created_at: string;
  updated_at: string;
}

export interface CiStatus {
  run: { id: number; status: string; conclusion: string | null; url: string; branch: string | null; event: string; startedAt: string; updatedAt: string } | null;
  nodes: Record<string, NodeState>;
  error: string | null;
}

/** Jüngster Durchlauf samt Zustand je Block. */
export async function ciStatus(projectId: string): Promise<CiStatus> {
  const p = await project(projectId);
  const gh = p ? await github(p) : null;
  const pipeline = p ? readPipeline(p.ciPipeline) : null;
  if (!p || !gh || !pipeline) return { run: null, nodes: {}, error: null };
  try {
    const runs = await request<{ workflow_runs?: GhRun[] }>("GET", `${gh.api}/actions/workflows/${CI_FILE}/runs?per_page=1`, gh.headers);
    const run = runs?.workflow_runs?.[0];
    if (!run) return { run: null, nodes: nodeStates(pipeline, [], null), error: null };
    const jobs = await request<{ jobs?: Array<{ steps?: GhStep[] }> }>("GET", `${gh.api}/actions/runs/${run.id}/jobs`, gh.headers);
    const steps = (jobs?.jobs ?? []).flatMap((j) => j.steps ?? []);
    return {
      run: { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, branch: run.head_branch, event: run.event, startedAt: run.created_at, updatedAt: run.updated_at },
      nodes: nodeStates(pipeline, steps, run.status),
      error: null,
    };
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return { run: null, nodes: nodeStates(pipeline, [], null), error: null };
    return { run: null, nodes: {}, error: err instanceof GitError ? err.message : tk("git", "errors.unreachable") };
  }
}
