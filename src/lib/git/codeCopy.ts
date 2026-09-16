import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { listRemoteBranchesViaGit, localHeadViaGit, mirrorBranchViaGit } from "./gitCli";

// Lokale Code-Kopie für Code-Suche und Code-Netz (#39, #57, #60). GitHub,
// GitLab und Gitea gleicht VibeWorks über die API ab – dort gibt es ohne diesen
// Schritt keinen Klon. Geholt wird bei Bedarf und nur, wenn es einen neuen
// Commit gibt: flach (ein Commit), mit demselben Token und Host wie beim Abgleich.

const RETRY_MS = 60_000;
const BRANCHES_MS = 5 * 60_000;
const lastTry = new Map<string, number>();
const branchCache = new Map<string, { at: number; branches: string[] }>();

async function projectRepo(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true } });
  const parsed = parseRepoUrl(project?.repoUrl ?? null);
  if (!project?.repoUrl || !parsed) return null;
  const stored = await tokenCipherFor(project);
  let token: string | null = null;
  if (stored) {
    try {
      token = decrypt(stored.cipher);
    } catch {
      return null;
    }
  }
  return { project, parsed, token, repoUrl: project.repoUrl };
}

export interface CodeCopy {
  branch: string | null;
  /** Commit der lokalen Kopie */
  head: string | null;
  error: string | null;
}

/** Sorgt dafür, dass der Zweig lokal auf dem aktuellen Stand liegt. Wirft nie. */
export async function ensureCodeCopy(projectId: string, wanted?: string | null): Promise<CodeCopy> {
  const cache = await db.repoCache.findUnique({ where: { projectId }, select: { provider: true, defaultBranch: true, commits: true } });
  const branch = wanted || cache?.defaultBranch || null;
  if (!cache || !branch) return { branch, head: null, error: null };
  const head = await localHeadViaGit(projectId, branch);
  const isDefault = branch === cache.defaultBranch;
  const latest = isDefault ? (((cache.commits as unknown as Array<{ sha?: string }> | null) ?? [])[0]?.sha ?? null) : null;
  // Beliebige Git-Server: der Abgleich klont den Hauptzweig schon selbst
  if (isDefault && cache.provider === "git" && head) return { branch, head, error: null };
  if (head && latest && head === latest) return { branch, head, error: null };

  const key = `${projectId}:${branch}`;
  if (head && Date.now() - (lastTry.get(key) ?? 0) < RETRY_MS) return { branch, head, error: null };
  lastTry.set(key, Date.now());
  try {
    const repo = await projectRepo(projectId);
    if (!repo) return { branch, head, error: "git.errors.badRepoUrl" };
    await mirrorBranchViaGit(projectId, repo.repoUrl, repo.parsed, repo.token, branch);
    return { branch, head: await localHeadViaGit(projectId, branch), error: null };
  } catch (err) {
    console.error("[code-copy]", projectId, branch, err instanceof Error ? err.message : err);
    return { branch, head, error: err instanceof Error ? err.message : "git.errors.gitFailed" };
  }
}

/** Zweige des Repositories – fünf Minuten gemerkt. Leer, wenn der Server nicht antwortet. */
export async function projectBranches(projectId: string): Promise<string[]> {
  const hit = branchCache.get(projectId);
  if (hit && Date.now() - hit.at < BRANCHES_MS) return hit.branches;
  const repo = await projectRepo(projectId);
  const branches = repo ? await listRemoteBranchesViaGit(repo.repoUrl, repo.parsed, repo.token).catch(() => []) : [];
  branchCache.set(projectId, { at: Date.now(), branches });
  return branches;
}
