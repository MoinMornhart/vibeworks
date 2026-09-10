import type { Prisma, RepoCache } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { fetchRepository, GitError, type CommitInfo } from "./providers";

export function serializeRepoCache(c: RepoCache) {
  return {
    provider: c.provider,
    fullName: c.fullName,
    webUrl: c.webUrl,
    defaultBranch: c.defaultBranch,
    description: c.description,
    stars: c.stars,
    commits: (c.commits as unknown as CommitInfo[]) ?? [],
    fetchedAt: c.fetchedAt.toISOString(),
    error: c.error,
  };
}
export type RepoCacheView = ReturnType<typeof serializeRepoCache>;

/**
 * Gleicht das Repository eines Projekts ab. Ein Fehlschlag überschreibt die
 * gespeicherten Commits nicht – er landet nur als `error` am Stand.
 */
export async function syncProjectRepository(project: { id: string; ownerId: string; repoUrl: string | null; repoTokenCipher: string | null }): Promise<RepoCache> {
  const parsed = parseRepoUrl(project.repoUrl);
  const fail = (message: string) =>
    db.repoCache.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, provider: "", fullName: parsed?.path ?? project.repoUrl ?? "", webUrl: project.repoUrl ?? "", error: message },
      update: { error: message, fetchedAt: new Date() },
    });

  if (!parsed) return fail("Die Repository-Adresse ist nicht lesbar – erwartet z. B. https://github.com/owner/name.");
  let token: string | null = null;
  const stored = await tokenCipherFor(project);
  if (stored) {
    try {
      token = decrypt(stored.cipher);
    } catch {
      return fail("Das gespeicherte Token lässt sich nicht entschlüsseln (APP_SECRET geändert?) – bitte neu hinterlegen.");
    }
  }

  try {
    const snap = await fetchRepository(parsed, token);
    const data = {
      provider: snap.provider,
      fullName: snap.fullName,
      webUrl: snap.webUrl,
      defaultBranch: snap.defaultBranch,
      description: snap.description,
      stars: snap.stars,
      commits: snap.commits as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
      error: null,
    };
    return await db.repoCache.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...data }, update: data });
  } catch (err) {
    return fail(err instanceof GitError ? err.message : "Der Abgleich ist fehlgeschlagen.");
  }
}
