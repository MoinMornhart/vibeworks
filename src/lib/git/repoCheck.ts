import { Prisma, type RepoCache } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { appLink, notifyUser } from "@/lib/notify";
import { FetchBlockedError, safeFetch } from "@/lib/security/ssrf";
import { readZip } from "@/lib/zip";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { apiBase, authHeaders, GitError, request } from "./providers";
import { REPO_CHECK_ARTIFACT, REPO_CHECK_FILE, REPO_CHECK_PATH, REPO_CHECK_WORKFLOW } from "./repoCheckWorkflow";
import { checkGotWorse, parseCheckReport, type CheckReport } from "./repoCheckLogic";

// Repo-Check über GitHub Actions: VibeWorks legt den Workflow selbst ins
// Repository (danach aktualisiert es nur die eigene, unveränderte Datei),
// fragt den jüngsten Lauf ab und holt den Bericht aus dem Artefakt. Wer die
// Datei im Repository löscht, schaltet den Check für das Projekt ab.
// Die Ergebnisse sehen nur Projektmitglieder – serializeRepoCache (auch für
// öffentliche Seiten) enthält sie bewusst nicht.

const DAY = 86_400_000;
/** Ist der letzte Lauf abgeschlossen, reicht ein Blick alle 30 Minuten. */
const POLL_MS = 30 * 60_000;
const MAX_ARTIFACT = 5 * 1024 * 1024;
const REPORT_FILE = "vibeworks-check.json";
/** Erste Zeile der Vorlage – nur Dateien mit dieser Zeile aktualisiert oder entfernt VibeWorks. */
const MARKER = REPO_CHECK_WORKFLOW.split("\n")[0];

export type CheckStatus = "waiting" | "running" | "done" | "failed" | "noPermission";
/** Mit diesen Zuständen war die Datei schon einmal erfolgreich eingerichtet. */
const INSTALLED = new Set(["waiting", "running", "done", "failed"]);

const CLEARED = {
  checkStatus: null,
  checkReport: Prisma.DbNull,
  checkRunUrl: null,
  checkRunAt: null,
  checkFetchedAt: null,
  checkError: null,
  checkInstalledAt: null,
} satisfies Prisma.RepoCacheUpdateManyMutationInput;

interface GhContent { sha: string; content?: string }
interface GhRun { id: number; status: string; conclusion: string | null; html_url: string; updated_at: string }
interface GhArtifact { name: string; expired: boolean; size_in_bytes: number; archive_download_url: string }

async function context(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      repoUrl: true,
      repoTokenCipher: true,
      repoCheck: true,
      repoCache: { select: { provider: true, defaultBranch: true, checkStatus: true, checkReport: true, checkRunUrl: true, checkFetchedAt: true, checkInstalledAt: true } },
    },
  });
  const cache = project?.repoCache;
  if (!project?.repoUrl || cache?.provider !== "github") return null;
  const parsed = parseRepoUrl(project.repoUrl);
  if (!parsed) return null;
  const stored = await tokenCipherFor(project);
  let token: string | null = null;
  try {
    token = stored ? decrypt(stored.cipher) : null;
  } catch {
    token = null;
  }
  // Einrichten und Artefakte laden geht nur mit Token
  if (!token) return null;
  return { project, cache, api: apiBase("github", parsed), headers: authHeaders("github", token), branch: cache.defaultBranch };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>;

async function readWorkflow(ctx: Ctx): Promise<{ sha: string; text: string } | null> {
  try {
    const ref = ctx.branch ? `?ref=${encodeURIComponent(ctx.branch)}` : "";
    const file = await request<GhContent>("GET", `${ctx.api}/contents/${REPO_CHECK_PATH}${ref}`, ctx.headers);
    return { sha: file.sha, text: Buffer.from(file.content ?? "", "base64").toString("utf8") };
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Workflow-Datei anlegen oder auf den Stand der Vorlage bringen. Eine selbst
 * angepasste Datei (ohne VibeWorks-Kopfzeile) bleibt, wie sie ist.
 */
async function ensureWorkflow(ctx: Ctx): Promise<"created" | "updated" | "current" | "custom" | "removed"> {
  const current = await readWorkflow(ctx);
  if (!current) {
    if (ctx.cache.checkInstalledAt && INSTALLED.has(ctx.cache.checkStatus ?? "")) return "removed";
  } else if (current.text === REPO_CHECK_WORKFLOW) {
    return "current";
  } else if (!current.text.startsWith(MARKER)) {
    return "custom";
  }
  await request("PUT", `${ctx.api}/contents/${REPO_CHECK_PATH}`, ctx.headers, {
    message: current ? "VibeWorks: Repo-Check aktualisieren" : "VibeWorks: Repo-Check einrichten",
    content: Buffer.from(REPO_CHECK_WORKFLOW, "utf8").toString("base64"),
    ...(current ? { sha: current.sha } : {}),
    ...(ctx.branch ? { branch: ctx.branch } : {}),
  });
  return current ? "updated" : "created";
}

function installError(err: unknown): { status: CheckStatus | null; error: string } {
  if (err instanceof GitError && (err.status === 403 || err.status === 404)) return { status: "noPermission", error: tk("check", "errors.noPermission") };
  if (err instanceof GitError && (err.status === 409 || err.status === 422)) return { status: "noPermission", error: tk("check", "errors.protected") };
  return { status: null, error: err instanceof GitError ? err.message : tk("git", "errors.unreachable") };
}

async function latestRun(ctx: Ctx): Promise<GhRun | null> {
  const branch = ctx.branch ? `&branch=${encodeURIComponent(ctx.branch)}` : "";
  try {
    const res = await request<{ workflow_runs?: GhRun[] }>("GET", `${ctx.api}/actions/workflows/${REPO_CHECK_FILE}/runs?per_page=1${branch}`, ctx.headers);
    return res?.workflow_runs?.[0] ?? null;
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null; // gerade erst angelegt
    throw err;
  }
}

async function downloadReport(ctx: Ctx, runId: number): Promise<CheckReport> {
  const list = await request<{ artifacts?: GhArtifact[] }>("GET", `${ctx.api}/actions/runs/${runId}/artifacts?per_page=20`, ctx.headers);
  const artifact = (list?.artifacts ?? []).find((a) => a.name === REPO_CHECK_ARTIFACT && !a.expired);
  if (!artifact) throw new GitError(tk("check", "errors.noArtifact"));
  if (artifact.size_in_bytes > MAX_ARTIFACT) throw new GitError(tk("check", "errors.tooLarge"));
  // Das Token geht nur an die API selbst; die Weiterleitung zum Speicher bekommt es nicht (safeFetch).
  if (new URL(artifact.archive_download_url).origin !== new URL(ctx.api).origin) throw new GitError(tk("check", "errors.badReport"));
  let res: Response;
  try {
    res = await safeFetch(artifact.archive_download_url, { headers: { "User-Agent": "VibeWorks", ...ctx.headers }, timeoutMs: 30_000 });
  } catch (err) {
    throw new GitError(err instanceof FetchBlockedError ? err.message : tk("git", "errors.unreachable"));
  }
  if (!res.ok) throw new GitError(tk("git", "errors.http", { status: res.status }), res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ARTIFACT) throw new GitError(tk("check", "errors.tooLarge"));
  try {
    const entry = readZip(buf).find((e) => e.name === REPORT_FILE);
    if (!entry) throw new Error("fehlt");
    return parseCheckReport(JSON.parse(entry.data.toString("utf8")));
  } catch {
    throw new GitError(tk("check", "errors.badReport"));
  }
}

async function run(projectId: string, force: boolean): Promise<void> {
  const ctx = await context(projectId);
  if (!ctx?.project.repoCheck) return;
  const { cache } = ctx;
  const now = new Date();
  const save = (data: Prisma.RepoCacheUpdateInput) => db.repoCache.update({ where: { projectId }, data });

  // 1. Workflow-Datei – einmal am Tag nachsehen, ob sie da und aktuell ist
  let status = cache.checkStatus;
  if (force || !cache.checkInstalledAt || now.getTime() - cache.checkInstalledAt.getTime() > DAY) {
    try {
      const result = await ensureWorkflow(ctx);
      if (result === "removed") {
        await db.project.update({ where: { id: projectId }, data: { repoCheck: false } });
        await save(CLEARED);
        return;
      }
      if (result === "created" || result === "updated" || !status || status === "noPermission") status = "waiting";
      await save({ checkInstalledAt: now, checkStatus: status, checkError: null });
    } catch (err) {
      const e = installError(err);
      await save({ checkInstalledAt: now, checkError: e.error, ...(e.status ? { checkStatus: e.status } : {}) });
      return;
    }
  }
  if (status === "noPermission") return;

  // 2. Jüngster Lauf – solange er aussteht bei jedem Abgleich, danach alle 30 Minuten
  const settled = status === "done" || status === "failed";
  if (!force && settled && cache.checkFetchedAt && now.getTime() - cache.checkFetchedAt.getTime() < POLL_MS) return;
  try {
    const latest = await latestRun(ctx);
    if (!latest) {
      await save({ checkFetchedAt: now, checkStatus: "waiting" });
      return;
    }
    if (latest.status !== "completed") {
      await save({ checkFetchedAt: now, checkStatus: "running", checkRunUrl: latest.html_url });
      return;
    }
    const runAt = new Date(latest.updated_at);
    if (latest.conclusion !== "success") {
      await save({ checkFetchedAt: now, checkStatus: "failed", checkRunUrl: latest.html_url, checkRunAt: runAt, checkError: tk("check", "errors.runFailed", { conclusion: latest.conclusion ?? "?" }) });
      return;
    }
    if (status === "done" && cache.checkRunUrl === latest.html_url && cache.checkReport) {
      await save({ checkFetchedAt: now });
      return;
    }
    const report = await downloadReport(ctx, latest.id);
    await save({ checkFetchedAt: now, checkStatus: "done", checkRunUrl: latest.html_url, checkRunAt: runAt, checkReport: report as unknown as Prisma.InputJsonValue, checkError: null });
    const before = cache.checkReport ? parseCheckReport(cache.checkReport) : null;
    if (checkGotWorse(before, report)) void notifyCheckAlert(ctx.project, report).catch((err) => console.error("[repo-check]", projectId, err));
  } catch (err) {
    await save({ checkFetchedAt: now, checkError: err instanceof GitError ? err.message : tk("git", "errors.unreachable") });
  }
}

const running = new Map<string, Promise<void>>();

/** Beim Git-Abgleich: einrichten, Lauf abfragen, Bericht holen – je Projekt nur einmal gleichzeitig. */
export function refreshRepoCheck(projectId: string, force = false): Promise<void> {
  const active = running.get(projectId);
  if (active) return active;
  const job = run(projectId, force).finally(() => running.delete(projectId));
  running.set(projectId, job);
  return job;
}

/** „Jetzt prüfen“: Datei sicherstellen und einen Lauf anstoßen. Wirft GitError. */
export async function startRepoCheck(projectId: string): Promise<void> {
  const ctx = await context(projectId);
  if (!ctx) throw new GitError(tk("check", "errors.needToken"));
  if (!ctx.project.repoCheck) throw new GitError(tk("check", "errors.off"));
  await refreshRepoCheck(projectId, true);
  const fresh = await db.repoCache.findUnique({ where: { projectId }, select: { checkStatus: true, checkError: true } });
  if (fresh?.checkStatus === "noPermission") throw new GitError(fresh.checkError ?? tk("check", "errors.noPermission"));
  if (fresh?.checkStatus === "running") return;
  try {
    await request("POST", `${ctx.api}/actions/workflows/${REPO_CHECK_FILE}/dispatches`, ctx.headers, { ref: ctx.branch ?? "main" });
  } catch (err) {
    // Gerade erst angelegt: GitHub kennt den Workflow noch nicht – der Push startet ihn ohnehin
    if (!(err instanceof GitError && err.status === 404)) throw err;
  }
  await db.repoCache.update({ where: { projectId }, data: { checkStatus: "waiting", checkFetchedAt: new Date(), checkError: null } });
}

/**
 * Ein- oder ausschalten. Aus: die eigene Datei wieder aus dem Repository
 * nehmen (eine selbst angepasste bleibt). Liefert, ob entfernt wurde, und
 * einen Fehlerschlüssel, falls das nicht ging.
 */
export async function setRepoCheck(projectId: string, enabled: boolean): Promise<{ removed: boolean; error: string | null }> {
  await db.project.update({ where: { id: projectId }, data: { repoCheck: enabled } });
  await db.repoCache.updateMany({ where: { projectId }, data: CLEARED });
  if (enabled) {
    void refreshRepoCheck(projectId, true).catch((err) => console.error("[repo-check]", projectId, err));
    return { removed: false, error: null };
  }
  const ctx = await context(projectId);
  if (!ctx) return { removed: false, error: null };
  try {
    const current = await readWorkflow(ctx);
    if (!current?.text.startsWith(MARKER)) return { removed: false, error: null };
    await request("DELETE", `${ctx.api}/contents/${REPO_CHECK_PATH}`, ctx.headers, {
      message: "VibeWorks: Repo-Check entfernen",
      sha: current.sha,
      ...(ctx.branch ? { branch: ctx.branch } : {}),
    });
    return { removed: true, error: null };
  } catch (err) {
    return { removed: false, error: installError(err).error };
  }
}

async function notifyCheckAlert(project: { id: string; name: string; ownerId: string }, report: CheckReport): Promise<void> {
  await notifyUser(project.ownerId, "checkAlert", (t) => ({
    event: "checkAlert",
    title: t("events.checkAlert.title", { project: project.name }),
    message: t("events.checkAlert.message", { secrets: report.counts.secrets, vulns: report.counts.vulnerabilities }),
    url: appLink(`/projects/${project.id}#repo-check`),
    // Ein Geheimnis im Repository ist kritisch, Sicherheitslücken „nur“ dringend
    priority: report.counts.secrets > 0 ? "urgent" : "high",
  }));
}

type CheckFields = Pick<RepoCache, "webUrl" | "defaultBranch" | "checkStatus" | "checkReport" | "checkRunUrl" | "checkRunAt" | "checkFetchedAt" | "checkError">;

/** Nur für angemeldete Projektmitglieder – nie für öffentliche Seiten. */
export function serializeRepoCheck(enabled: boolean, c: CheckFields | null) {
  return {
    enabled,
    status: (c?.checkStatus ?? null) as CheckStatus | null,
    report: c?.checkReport ? parseCheckReport(c.checkReport) : null,
    runUrl: c?.checkRunUrl ?? null,
    runAt: c?.checkRunAt?.toISOString() ?? null,
    fetchedAt: c?.checkFetchedAt?.toISOString() ?? null,
    error: c?.checkError ?? null,
    webUrl: c?.webUrl ?? "",
    branch: c?.defaultBranch ?? null,
  };
}
export type RepoCheckView = ReturnType<typeof serializeRepoCheck>;
