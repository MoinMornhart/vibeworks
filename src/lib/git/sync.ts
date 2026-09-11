import { Prisma, type RepoCache } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { fetchRepository, GitError, type CommitInfo } from "./providers";
import { fetchCi, type CiStatus } from "./ci";
import { appLink, notifyUser } from "@/lib/notify";
import { syncProjectProgress } from "@/lib/tasks";
import { refreshDeps } from "./deps";
import type { DepsReport } from "./depsLogic";

export function serializeRepoCache(c: RepoCache) {
  return {
    provider: c.provider,
    fullName: c.fullName,
    webUrl: c.webUrl,
    defaultBranch: c.defaultBranch,
    description: c.description,
    stars: c.stars,
    commits: (c.commits as unknown as CommitInfo[]) ?? [],
    ci: (c.ci as unknown as CiStatus | null) ?? null,
    deps: (c.deps as unknown as DepsReport | null) ?? null,
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

  // Fehler als Übersetzungsschlüssel speichern – die Oberfläche übersetzt sie beim Anzeigen.
  if (!parsed) return fail(tk("git", "errors.badRepoUrl"));
  let token: string | null = null;
  const stored = await tokenCipherFor(project);
  if (stored) {
    try {
      token = decrypt(stored.cipher);
    } catch {
      return fail(tk("git", "errors.decrypt"));
    }
  }

  try {
    const previous = await db.repoCache.findUnique({ where: { projectId: project.id }, select: { ci: true } });
    const snap = await fetchRepository(parsed, token);
    // CI ist ein Zusatz: klappt der Abruf nicht, bleibt der Commit-Stand trotzdem gültig.
    const ci = await fetchCi(snap.provider, parsed, token, snap.defaultBranch, snap.commits[0]?.sha ?? null).catch(() => null);
    const data = {
      provider: snap.provider,
      fullName: snap.fullName,
      webUrl: snap.webUrl,
      defaultBranch: snap.defaultBranch,
      description: snap.description,
      stars: snap.stars,
      commits: snap.commits as unknown as Prisma.InputJsonValue,
      ci: ci ? (ci as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      fetchedAt: new Date(),
      error: null,
    };
    const saved = await db.repoCache.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...data }, update: data });
    // Commits und CI fließen in den automatischen Fortschritt ein
    await syncProjectProgress(project.id);
    // Abhängigkeiten höchstens einmal am Tag – im Hintergrund, der Abgleich wartet nicht darauf
    void refreshDeps(project.id).catch((err) => console.error("[deps]", project.id, err));
    // Nur beim Umschlagen auf Rot melden, nicht bei jedem Abgleich einer roten CI
    const before = (previous?.ci as { state?: string } | null)?.state;
    if (ci?.state === "failure" && before !== "failure") void notifyCiFailed(project.id, project.ownerId, ci);
    return saved;
  } catch (err) {
    return fail(err instanceof GitError ? err.message : tk("git", "errors.syncFailed"));
  }
}

async function notifyCiFailed(projectId: string, ownerId: string, ci: CiStatus): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) return;
  const run = ci.runs.find((r) => r.state === "failure") ?? ci.runs[0];
  await notifyUser(ownerId, "ciFailed", (t) => ({
    event: "ciFailed",
    title: t("events.ciFailed.title", { project: project.name }),
    message: t("events.ciFailed.message", { run: run?.name ?? "CI" }),
    url: run?.url ?? appLink(`/projects/${projectId}`),
    priority: "high",
  }));
}
