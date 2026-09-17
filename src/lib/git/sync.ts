import { Prisma, type RepoCache } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { guessProvider, parseRepoUrl, type ParsedRepo } from "./parse";
import { accountTokenFor, tokenCipherFor } from "./token";
import { fetchRepository, GitError, type CommitInfo, type RepoSnapshot } from "./providers";
import { fetchViaGit } from "./gitCli";
import { fetchCi, type CiStatus } from "./ci";
import { appLink, notifyUser } from "@/lib/notify";
import { syncProjectProgress } from "@/lib/tasks";
import { refreshDeps } from "./deps";
import { refreshRepoCheck } from "./repoCheck";
import { refreshLighthouse } from "./lighthouse";
import type { DepsReport } from "./depsLogic";

/** Ab so vielen Fehlschlägen in Folge kommt eine Benachrichtigung (einmal, bis es wieder klappt). */
const FAILS_BEFORE_NOTICE = 3;

type SyncProject = { id: string; ownerId: string; repoUrl: string | null; repoTokenCipher: string | null };

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
 * gespeicherten Commits nicht – er landet nur als `error` am Stand und zählt
 * mit; ab dem dritten in Folge gibt es eine Benachrichtigung.
 */
export async function syncProjectRepository(project: SyncProject): Promise<RepoCache> {
  const parsed = parseRepoUrl(project.repoUrl);
  const fail = (message: string) => recordFailure(project, parsed?.path ?? project.repoUrl ?? "", message);

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
    const previous = await db.repoCache.findUnique({ where: { projectId: project.id }, select: { ci: true, provider: true } });
    const snap = await fetchSnapshot(project, parsed, token, previous?.provider ?? null);
    // CI ist ein Zusatz: klappt der Abruf nicht, bleibt der Commit-Stand trotzdem gültig. Beliebige Git-Server kennen keine.
    const ci = snap.provider === "git" ? null : await fetchCi(snap.provider, parsed, token, snap.defaultBranch, snap.commits[0]?.sha ?? null).catch(() => null);
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
      failCount: 0,
      errorSince: null,
      errorNotified: false,
    };
    const saved = await db.repoCache.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...data }, update: data });
    // Commits und CI fließen in den automatischen Fortschritt ein
    await syncProjectProgress(project.id);
    // Abhängigkeiten höchstens einmal am Tag – im Hintergrund, der Abgleich wartet nicht darauf
    void refreshDeps(project.id).catch((err) => console.error("[deps]", project.id, err));
    // Repo-Check (nur GitHub): einrichten, Lauf abfragen, Bericht holen – ebenfalls im Hintergrund
    if (snap.provider === "github") void refreshRepoCheck(project.id).catch((err) => console.error("[repo-check]", project.id, err));
    // Lighthouse-Check der Live-Seite (#82) – nur, wenn eingeschaltet
    if (snap.provider === "github") void refreshLighthouse(project.id).catch((err) => console.error("[lighthouse]", project.id, err));
    // Nur beim Umschlagen auf Rot melden, nicht bei jedem Abgleich einer roten CI
    const before = (previous?.ci as { state?: string } | null)?.state;
    if (ci?.state === "failure" && before !== "failure") void notifyCiFailed(project.id, project.ownerId, ci);
    return saved;
  } catch (err) {
    return fail(err instanceof GitError ? err.message : tk("git", "errors.syncFailed"));
  }
}

/**
 * Über die Anbieter-API – bei einer Git-Verbindung vom Typ „Git“ oder einem
 * unbekannten Server ohne GitHub-/GitLab-/Gitea-API direkt per git.
 */
async function fetchSnapshot(project: SyncProject, parsed: ParsedRepo, token: string | null, previousProvider: string | null): Promise<RepoSnapshot> {
  const account = await accountTokenFor(project.ownerId, project.repoUrl);
  if (account?.provider === "git" || previousProvider === "git") return fetchViaGit(project.id, project.repoUrl!, parsed, token);
  try {
    return await fetchRepository(parsed, token);
  } catch (err) {
    if (guessProvider(parsed.host) || !(err instanceof GitError)) throw err;
    try {
      return await fetchViaGit(project.id, project.repoUrl!, parsed, token);
    } catch (gitErr) {
      // Verlangt der Server einen Zugang, ist das die hilfreichere Meldung – sonst die der API
      throw gitErr instanceof GitError && gitErr.status === 401 ? gitErr : err;
    }
  }
}

async function recordFailure(project: SyncProject, fullName: string, message: string): Promise<RepoCache> {
  const now = new Date();
  let saved = await db.repoCache.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, provider: "", fullName, webUrl: project.repoUrl ?? "", error: message, fetchedAt: now, failCount: 1, errorSince: now },
    update: { error: message, fetchedAt: now, failCount: { increment: 1 } },
  });
  if (!saved.errorSince) saved = await db.repoCache.update({ where: { projectId: project.id }, data: { errorSince: now } });
  if (saved.failCount >= FAILS_BEFORE_NOTICE && !saved.errorNotified) {
    saved = await db.repoCache.update({ where: { projectId: project.id }, data: { errorNotified: true } });
    void notifyGitFailed(project.id, project.ownerId, message);
  }
  return saved;
}

async function notifyGitFailed(projectId: string, ownerId: string, error: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) return;
  await notifyUser(ownerId, "gitFailed", (t, locale) => ({
    event: "gitFailed",
    title: t("events.gitFailed.title", { project: project.name }),
    message: t("events.gitFailed.message", { error: translateMessage(locale, error) }),
    url: appLink(`/projects/${projectId}`),
    priority: "high",
  }));
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
