import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { decrypt } from "@/lib/crypto";
import { appLink } from "@/lib/notify";
import { tk } from "@/lib/i18n/messages";
import { ensureCodeCopy, projectBranches } from "./codeCopy";
import { listFilesViaGit } from "./gitCli";
import { parseRepoUrl } from "./parse";
import { apiBase, authHeaders, GitError, request } from "./providers";
import { tokenCipherFor } from "./token";
import {
  appendGitignore,
  normalizeFilter,
  prViolations,
  scanFiles,
  STATUS_CONTEXT,
  statusDescription,
  type FileFilter,
  type FilterScan,
  type PrFile,
  type Violation,
} from "./fileFilterLogic";

// Dateifilter (#92) mit GitHub: Müll per Pull Request entfernen und offene
// Pull Requests prüfen – Verstöße setzen einen roten Commit-Status, den eine
// Branch-Regel („Require status checks“) zur Merge-Sperre macht.

const MAX_PRS = 20;
const MAX_REMOVE = 200;

/** GitHub-Projekt mit Zugang des Besitzers (bzw. Projekt-Token) – null, wenn es keins ist. */
export async function githubContext(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, fileFilter: true, repoCache: { select: { provider: true, defaultBranch: true } } },
  });
  const parsed = parseRepoUrl(project?.repoUrl ?? null);
  if (!project || !parsed || project.repoCache?.provider !== "github") return null;
  const stored = await tokenCipherFor(project);
  if (!stored) return null;
  let token: string;
  try {
    token = decrypt(stored.cipher);
  } catch {
    return null;
  }
  return { project, parsed, token, api: apiBase("github", parsed), headers: authHeaders("github", token), filter: normalizeFilter(project.fileFilter) };
}

export async function saveFilter(projectId: string, filter: FileFilter): Promise<void> {
  await db.project.update({ where: { id: projectId }, data: { fileFilter: filter as unknown as Prisma.InputJsonValue } });
}

export interface PrCheck {
  number: number;
  title: string;
  url: string;
  sha: string;
  violations: Violation[];
  allowed: boolean;
}

export interface FilterView {
  filter: FileFilter;
  /** Geprüfter Zweig, Hauptzweig und alle Zweige des Repositorys (#109) */
  branch: string | null;
  defaultBranch: string | null;
  branches: string[];
  scan: FilterScan | null;
  scanError: string | null;
  github: boolean;
  prs: PrCheck[];
  prError: string | null;
}

/** Filter, Scan der Code-Kopie und der Stand der offenen Pull Requests. */
export async function filterView(projectId: string, wanted?: string | null): Promise<FilterView> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { fileFilter: true } });
  const filter = normalizeFilter(project?.fileFilter);
  const cache = await db.repoCache.findUnique({ where: { projectId }, select: { defaultBranch: true } });
  const copy = await ensureCodeCopy(projectId, wanted ?? null);
  const files = copy.head ? await listFilesViaGit(projectId, copy.branch) : [];
  const branches = await projectBranches(projectId).catch(() => []);
  const scan = files.length ? scanFiles(files, filter) : null;
  const ctx = await githubContext(projectId);
  let prs: PrCheck[] = [];
  let prError: string | null = null;
  if (ctx) {
    try {
      prs = await checkPullRequests(projectId, { dryRun: true });
    } catch (err) {
      prError = err instanceof Error ? err.message : tk("git", "errors.gitFailed");
    }
  }
  return { filter, branch: copy.branch, defaultBranch: cache?.defaultBranch ?? null, branches, scan, scanError: scan ? null : copy.error, github: Boolean(ctx), prs, prError };
}

interface GhPull {
  number: number;
  title: string;
  html_url: string;
  head: { sha: string };
}

/**
 * Offene Pull Requests prüfen und den Commit-Status setzen. Ein neuer Stand je
 * Pull Request wird nur einmal gemeldet. dryRun: nur ansehen, nichts schreiben.
 */
export async function checkPullRequests(projectId: string, opts: { dryRun?: boolean } = {}): Promise<PrCheck[]> {
  const ctx = await githubContext(projectId);
  if (!ctx || !ctx.filter.rules.length) return [];
  const pulls = await request<GhPull[]>("GET", `${ctx.api}/pulls?state=open&per_page=${MAX_PRS}`, ctx.headers);
  const checks: PrCheck[] = [];
  const checked = { ...ctx.filter.checked };
  let changed = false;
  for (const pr of pulls.slice(0, MAX_PRS)) {
    const files = await request<PrFile[]>("GET", `${ctx.api}/pulls/${pr.number}/files?per_page=100`, ctx.headers);
    const violations = prViolations(files, ctx.filter);
    const allowed = ctx.filter.allowed.some((a) => a.pr === pr.number && a.sha === pr.head.sha);
    const state = violations.length && !allowed ? "failure" : "success";
    checks.push({ number: pr.number, title: pr.title.slice(0, 200), url: pr.html_url, sha: pr.head.sha, violations, allowed });
    const mark = `${pr.head.sha}:${state}`;
    if (opts.dryRun || checked[String(pr.number)] === mark) continue;
    await request("POST", `${ctx.api}/statuses/${pr.head.sha}`, ctx.headers, {
      state,
      context: STATUS_CONTEXT,
      description: statusDescription(violations, allowed),
      target_url: appLink(`/projects/${projectId}#file-filter`),
    });
    checked[String(pr.number)] = mark;
    changed = true;
  }
  if (changed) await saveFilter(projectId, { ...ctx.filter, checked });
  return checks;
}

/** Hintergrund-Abgleich: Fehler nur protokollieren. */
export async function checkPullRequestsQuietly(projectId: string): Promise<void> {
  await checkPullRequests(projectId).catch((err) => console.warn("[datei-filter] %s:", projectId, err instanceof Error ? err.message : err));
}

/** Pull Request trotz Verstoß erlauben – gilt für genau diesen Stand. */
export async function allowPullRequest(projectId: string, pr: number, sha: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { fileFilter: true } });
  const filter = normalizeFilter(project?.fileFilter);
  if (!/^[0-9a-f]{7,64}$/.test(sha)) throw new ApiError(400, tk("git", "filter.errors.badSha"));
  await saveFilter(projectId, { ...filter, allowed: [...filter.allowed.filter((a) => a.pr !== pr), { pr, sha }] });
  await checkPullRequests(projectId);
}

interface GhRef {
  object: { sha: string };
}
interface GhCommit {
  sha: string;
  tree: { sha: string };
}

async function gitignoreOf(api: string, headers: Record<string, string>, branch: string): Promise<string> {
  try {
    const res = await request<{ content?: string; encoding?: string }>("GET", `${api}/contents/.gitignore?ref=${encodeURIComponent(branch)}`, headers);
    return res.encoding === "base64" && res.content ? Buffer.from(res.content, "base64").toString("utf8") : "";
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return "";
    throw err;
  }
}

/**
 * Müll entfernen: neuer Zweig mit einem Commit, der die Dateien löscht und die
 * Muster in .gitignore einträgt – als Pull Request, nichts landet direkt im
 * Hauptzweig.
 */
export async function cleanupPullRequest(projectId: string, files: string[], patterns: string[]): Promise<{ url: string; number: number }> {
  const ctx = await githubContext(projectId);
  if (!ctx) throw new ApiError(400, tk("git", "filter.errors.githubOnly"));
  const base = ctx.project.repoCache?.defaultBranch;
  if (!base) throw new ApiError(400, tk("graph", "errors.notSynced"));
  // Nur Dateien, die wirklich existieren und auf ein Müll-Muster passen
  const copy = await ensureCodeCopy(projectId, base);
  const existing = new Set(copy.head ? await listFilesViaGit(projectId, base) : []);
  const scan = scanFiles([...existing], { rules: [...ctx.filter.rules, ...patterns.map((pattern) => ({ pattern, kind: "trash" as const }))] }, MAX_REMOVE);
  const allowedFiles = new Set(scan.trash.map((t) => t.file));
  const remove = [...new Set(files)].filter((f) => allowedFiles.has(f)).slice(0, MAX_REMOVE);
  if (!remove.length) throw new ApiError(400, tk("git", "filter.errors.nothing"));

  const baseRef = await request<GhRef>("GET", `${ctx.api}/git/ref/heads/${encodeURIComponent(base)}`, ctx.headers);
  const baseCommit = await request<GhCommit>("GET", `${ctx.api}/git/commits/${baseRef.object.sha}`, ctx.headers);
  const gitignore = appendGitignore(await gitignoreOf(ctx.api, ctx.headers, base), [...new Set(scan.trash.filter((t) => remove.includes(t.file)).map((t) => t.pattern))]);
  const tree = await request<{ sha: string }>("POST", `${ctx.api}/git/trees`, ctx.headers, {
    base_tree: baseCommit.tree.sha,
    tree: [
      ...remove.map((path) => ({ path, mode: "100644", type: "blob", sha: null })),
      { path: ".gitignore", mode: "100644", type: "blob", content: gitignore },
    ],
  });
  const commit = await request<{ sha: string }>("POST", `${ctx.api}/git/commits`, ctx.headers, {
    message: `Müll entfernen (VibeWorks-Dateifilter)\n\n${remove.length} Datei(en) gelöscht, Muster in .gitignore ergänzt.`,
    tree: tree.sha,
    parents: [baseRef.object.sha],
  });
  const branch = `vibeworks/aufraeumen-${Date.now().toString(36)}`;
  await request("POST", `${ctx.api}/git/refs`, ctx.headers, { ref: `refs/heads/${branch}`, sha: commit.sha });
  const pr = await request<{ html_url: string; number: number }>("POST", `${ctx.api}/pulls`, ctx.headers, {
    title: `Müll entfernen (${remove.length} Datei${remove.length === 1 ? "" : "en"})`,
    head: branch,
    base,
    body: [
      "Von VibeWorks (Dateifilter) vorgeschlagen – bitte prüfen und mergen.",
      "",
      ...remove.slice(0, 50).map((f) => `- \`${f}\``),
      ...(remove.length > 50 ? [`- … und ${remove.length - 50} weitere`] : []),
      "",
      "Die passenden Muster stehen jetzt in `.gitignore`.",
    ].join("\n"),
  });
  return { url: pr.html_url, number: pr.number };
}

