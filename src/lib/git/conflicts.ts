import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { displayNameOf } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { githubContext } from "./fileFilter";
import { mergePreviewViaGit, pushMergeViaGit, readMergeBlobViaGit } from "./gitCli";
import { GitError, request } from "./providers";
import { checkSyntax } from "./conflictLogic";

// Merge-Konflikte in Pull Requests lösen (#92) – auch solche, bei denen GitHub
// „zu komplex für den Web-Editor“ sagt. VibeWorks rechnet den Merge mit git
// selbst, zeigt die Konflikte und schreibt die Lösung als Merge-Commit in den
// Zweig des Pull Requests. Nur Pull Requests aus demselben Repository.

const MAX_PRS = 20;
const MAX_FILE = 2 * 1024 * 1024;

interface GhPullDetail {
  number: number;
  title: string;
  html_url: string;
  mergeable: boolean | null;
  mergeable_state: string;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string; repo: { full_name: string } };
}

export interface ConflictPr {
  number: number;
  title: string;
  url: string;
  headRef: string;
  baseRef: string;
  /** Zweig liegt im selben Repository – nur dann kann VibeWorks die Lösung schreiben */
  sameRepo: boolean;
  /** true: Konflikte · null: GitHub rechnet noch */
  conflicted: boolean | null;
}

async function context(projectId: string) {
  const ctx = await githubContext(projectId);
  if (!ctx) throw new ApiError(400, tk("git", "filter.errors.githubOnly"));
  return ctx;
}

const toPr = (p: GhPullDetail): ConflictPr => ({
  number: p.number,
  title: p.title.slice(0, 200),
  url: p.html_url,
  headRef: p.head.ref,
  baseRef: p.base.ref,
  sameRepo: p.head.repo?.full_name === p.base.repo.full_name,
  conflicted: p.mergeable === null ? null : p.mergeable_state === "dirty" || p.mergeable === false,
});

/** Offene Pull Requests mit Konflikten (oder noch unbekanntem Stand). */
export async function conflictPullRequests(projectId: string): Promise<ConflictPr[]> {
  const ctx = await context(projectId);
  const list = await request<Array<{ number: number }>>("GET", `${ctx.api}/pulls?state=open&per_page=${MAX_PRS}`, ctx.headers);
  const out: ConflictPr[] = [];
  for (const { number } of list.slice(0, MAX_PRS)) {
    const pr = toPr(await request<GhPullDetail>("GET", `${ctx.api}/pulls/${number}`, ctx.headers));
    if (pr.conflicted !== false) out.push(pr);
  }
  return out;
}

export interface ConflictFile {
  path: string;
  /** Inhalt mit Konfliktmarkern – leer, wenn die Datei zu groß oder binär ist */
  merged: string;
  size: number;
  editable: boolean;
  /** Stand im Pull Request bzw. im Zielzweig (zum Vergleichen, ohne Marker) */
  pr: string | null;
  base: string | null;
}

export interface ConflictDetails {
  pr: ConflictPr;
  headSha: string;
  baseSha: string;
  files: ConflictFile[];
  messages: string;
}

async function preview(projectId: string, number: number) {
  const ctx = await context(projectId);
  const detail = await request<GhPullDetail>("GET", `${ctx.api}/pulls/${number}`, ctx.headers);
  const pr = toPr(detail);
  try {
    const merge = await mergePreviewViaGit(projectId, ctx.project.repoUrl!, ctx.parsed, ctx.token, pr.baseRef, number);
    return { ctx, pr, detail, merge };
  } catch (err) {
    throw new ApiError(502, err instanceof GitError ? err.message : tk("git", "errors.gitFailed"));
  }
}

/** Konflikte eines Pull Requests: Dateien mit Markern und beide Stände. */
export async function conflictDetails(projectId: string, number: number): Promise<ConflictDetails> {
  const { pr, merge } = await preview(projectId, number);
  const files: ConflictFile[] = [];
  for (const path of merge.conflicts) {
    const merged = await readMergeBlobViaGit(projectId, merge.tree, path);
    const editable = Boolean(merged && !merged.binary && merged.size <= MAX_FILE && merged.text !== "");
    const side = async (rev: string) => {
      const blob = editable ? await readMergeBlobViaGit(projectId, rev, path) : null;
      return blob && !blob.binary ? blob.text : null;
    };
    files.push({ path, merged: editable ? merged!.text : "", size: merged?.size ?? 0, editable, pr: await side("refs/vw/head"), base: await side("refs/vw/base") });
  }
  return { pr, headSha: merge.headSha, baseSha: merge.baseSha, files, messages: merge.messages };
}

/**
 * Lösung schreiben: der Merge wird frisch gerechnet – der Pull Request darf
 * sich nicht verändert haben, und genau seine Konfliktdateien müssen gelöst sein.
 */
export async function resolveConflicts(projectId: string, userId: string, number: number, headSha: string, files: Array<{ path: string; content: string }>): Promise<{ commit: string; url: string }> {
  const { ctx, pr, merge } = await preview(projectId, number);
  if (!pr.sameRepo) throw new ApiError(400, tk("git", "conflicts.errors.fork"));
  if (merge.headSha !== headSha) throw new ApiError(409, tk("git", "conflicts.errors.changed"));
  if (!merge.conflicts.length) throw new ApiError(409, tk("git", "conflicts.errors.noConflicts"));
  const wanted = new Set(merge.conflicts);
  const given = new Map(files.map((f) => [f.path, f.content]));
  if (given.size !== wanted.size || [...wanted].some((p) => !given.has(p))) throw new ApiError(400, tk("git", "conflicts.errors.incomplete"));
  for (const [path, content] of given) {
    if (Buffer.byteLength(content) > MAX_FILE) throw new ApiError(400, tk("git", "conflicts.errors.tooLarge", { path }));
    if (checkSyntax(path, content).problem === "markers") throw new ApiError(400, tk("git", "conflicts.errors.markers", { path }));
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
  const name = user ? displayNameOf(user) : "VibeWorks";
  try {
    const commit = await pushMergeViaGit(projectId, ctx.project.repoUrl!, ctx.parsed, ctx.token, {
      tree: merge.tree,
      headSha: merge.headSha,
      baseSha: merge.baseSha,
      headBranch: pr.headRef,
      files: [...given].map(([path, content]) => ({ path, content })),
      message: `Merge ${pr.baseRef} in ${pr.headRef} (Konflikte in VibeWorks gelöst)\n\n${[...given.keys()].map((p) => `- ${p}`).join("\n")}\n\nGelöst von ${name} in VibeWorks.`,
      author: { name: `${name} (VibeWorks)`, email: `${(user?.username ?? "vibeworks").replace(/[^\w.-]/g, "")}@users.noreply.vibeworks` },
    });
    return { commit, url: pr.url };
  } catch (err) {
    if (err instanceof GitError && err.status === 409) throw new ApiError(409, tk("git", "conflicts.errors.changed"));
    throw new ApiError(502, err instanceof GitError ? err.message : tk("git", "errors.gitFailed"));
  }
}
