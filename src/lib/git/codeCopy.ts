import { db } from "@/lib/db";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { appLink, notifyUser } from "@/lib/notify";
import { hit, MINUTE } from "@/lib/security/rateLimit";
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
export async function ensureCodeCopy(projectId: string, wanted?: string | null, opts: { force?: boolean } = {}): Promise<CodeCopy> {
  const cache = await db.repoCache.findUnique({ where: { projectId }, select: { provider: true, defaultBranch: true, commits: true, error: true } });
  const branch = wanted || cache?.defaultBranch || null;
  // Nicht still scheitern (#54, #79): sagen, dass erst der Abgleich klappen muss
  if (!cache || !branch) {
    const error = cache?.error || tk("graph", "errors.notSynced");
    return { branch, head: null, error };
  }
  const head = await localHeadViaGit(projectId, branch);
  const isDefault = branch === cache.defaultBranch;
  const latest = isDefault ? (((cache.commits as unknown as Array<{ sha?: string }> | null) ?? [])[0]?.sha ?? null) : null;
  // Beliebige Git-Server: der Abgleich klont den Hauptzweig schon selbst
  if (isDefault && cache.provider === "git" && head) return { branch, head, error: null };
  if (!opts.force && head && latest && head === latest) return { branch, head, error: null };

  const key = `${projectId}:${branch}`;
  if (!opts.force && head && Date.now() - (lastTry.get(key) ?? 0) < RETRY_MS) return { branch, head, error: null };
  lastTry.set(key, Date.now());
  try {
    const repo = await projectRepo(projectId);
    if (!repo) return { branch, head, error: tk("git", "errors.badRepoUrl") };
    await mirrorBranchViaGit(projectId, repo.repoUrl, repo.parsed, repo.token, branch);
    return { branch, head: await localHeadViaGit(projectId, branch), error: null };
  } catch (err) {
    console.error("[code-copy] %s %s:", projectId, branch, err instanceof Error ? err.message : err);
    const error = err instanceof Error ? err.message : tk("git", "errors.gitFailed");
    void notifyCopyFailed(projectId, error);
    return { branch, head, error };
  }
}

/** Besitzer benachrichtigen, dass die Code-Kopie nicht geholt werden konnte (#71) – höchstens einmal am Tag je Projekt. */
async function notifyCopyFailed(projectId: string, error: string): Promise<void> {
  if (!hit(`code-copy-failed:${projectId}`, 1, 24 * 60 * MINUTE).ok) return;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true, name: true } });
  if (!project) return;
  await notifyUser(project.ownerId, "gitFailed", (t, locale) => ({
    event: "gitFailed",
    title: t("events.codeCopyFailed.title", { project: project.name }),
    message: translateMessage(locale, error),
    url: appLink(`/projects/${projectId}#code-graph`),
  })).catch((e) => console.error("[code-copy] Meldung:", e));
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
