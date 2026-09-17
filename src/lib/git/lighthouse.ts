import { Prisma, type RepoCache } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { tk, makeT } from "@/lib/i18n/messages";
import { logActivity } from "@/lib/activity";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { truncate } from "@/lib/utils";
import { GitError } from "./providers";
import { pushTaskIssues } from "./issues";
import { depsTaskAction, shortList } from "./depsTasksLogic";
import { artifactJson, deleteRepoFile, dispatchWorkflow, githubTarget, installError, latestWorkflowRun, readRepoFile, writeRepoFile, type GhTarget } from "./githubActions";
import {
  buildLighthouseWorkflow,
  LH_ARTIFACT,
  LH_FILE,
  LH_MARKER,
  LH_PATH,
  LH_REPORT_FILE,
  lighthouseProblems,
  nextBaseline,
  parseLighthouseReport,
  readBaseline,
  safeLiveUrl,
  type LighthouseReport,
} from "./lighthouseLogic";

// Lighthouse-Check der Live-Seite (#82): wie der Repo-Check ein Workflow, den
// VibeWorks ins GitHub-Repository legt – aber nur, wenn der Besitzer ihn
// einschaltet. Deutliche Verschlechterungen und kaputte Links landen in einer
// Sammel-Aufgabe, die sich selbst pflegt.

const DAY = 86_400_000;
const POLL_MS = 60 * 60_000;
const MAX_ARTIFACT = 512 * 1024;
const TASK_KEY = "lighthouse";

type LhStatus = "waiting" | "running" | "done" | "failed" | "noPermission";
const INSTALLED = new Set(["waiting", "running", "done", "failed"]);

const CLEARED = {
  lhStatus: null,
  lhReport: Prisma.DbNull,
  lhRunUrl: null,
  lhRunAt: null,
  lhFetchedAt: null,
  lhError: null,
  lhInstalledAt: null,
} satisfies Prisma.RepoCacheUpdateManyMutationInput;

async function context(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      repoUrl: true,
      repoTokenCipher: true,
      liveUrl: true,
      lighthouse: true,
      status: true,
      buriedAt: true,
      owner: { select: { locale: true } },
      repoCache: { select: { lhStatus: true, lhReport: true, lhBaseline: true, lhRunUrl: true, lhFetchedAt: true, lhInstalledAt: true } },
    },
  });
  if (!project?.repoCache) return null;
  const target = await githubTarget(project);
  return target ? { project, cache: project.repoCache, target, url: safeLiveUrl(project.liveUrl) } : null;
}
type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>;

const readWorkflow = (t: GhTarget) => readRepoFile(t, LH_PATH);

async function ensureWorkflow(ctx: Ctx, url: string): Promise<"created" | "updated" | "current" | "custom" | "removed"> {
  const text = buildLighthouseWorkflow(url);
  const current = await readWorkflow(ctx.target);
  if (!current) {
    if (ctx.cache.lhInstalledAt && INSTALLED.has(ctx.cache.lhStatus ?? "")) return "removed";
  } else if (current.text === text) {
    return "current";
  } else if (!current.text.startsWith(LH_MARKER)) {
    return "custom";
  }
  await writeRepoFile(ctx.target, LH_PATH, text, current ? "VibeWorks: Lighthouse-Check aktualisieren" : "VibeWorks: Lighthouse-Check einrichten", current?.sha);
  return current ? "updated" : "created";
}

/** Sammel-Aufgabe „Live-Seite verschlechtert“ anlegen, anpassen oder erledigen. */
async function syncLighthouseTask(ctx: Ctx, report: LighthouseReport, baseline: ReturnType<typeof readBaseline>): Promise<void> {
  const { project } = ctx;
  if (project.status === "ARCHIVED" || project.buriedAt) return;
  const problems = lighthouseProblems(report, baseline);
  const t = makeT(project.owner.locale === "en" ? "en" : "de", "lighthouse");
  const lines = [
    ...problems.drops.map((d) => `- \`${d.category}\` – ${t(`categories.${d.category}`)}: ${d.before} → ${d.now}`),
    ...problems.links.map((l) => `- \`${l.url}\` – ${t("task.brokenLink", { status: l.status ?? (l.text || "?") })}`),
  ];
  const labels = problems.names.map((n) => (n.startsWith("http") ? t("task.link") : t(`categories.${n}` as "categories.performance")));
  const title = t("task.title", { n: problems.names.length, list: shortList([...new Set(labels)]) }).slice(0, 200);
  const description = `${t("task.intro", { url: report.url })}\n\n${lines.join("\n")}\n\n_${t("task.note")}_`;
  const task = await db.task.findUnique({ where: { projectId_autoKey: { projectId: project.id, autoKey: TASK_KEY } } });
  const action = depsTaskAction(task, { names: problems.names, description });
  let changed: string | null = null;
  if (action === "create") {
    const created = await db.task.create({
      data: { projectId: project.id, title, description, labels: [t("task.label")], autoKey: TASK_KEY, priority: 3, status: "TODO", position: await nextTaskPosition(db, project.id, "TODO"), createdVia: "auto" },
    });
    await logActivity({ projectId: project.id, userId: null, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(title, 60)}“ angelegt`, meta: { title: truncate(title, 60), taskId: created.id } });
    changed = created.id;
  } else if (action === "update") {
    await db.task.update({ where: { id: task!.id }, data: { title, description } });
    changed = task!.id;
  } else if (action === "reopen" || action === "close") {
    const to = action === "reopen" ? "TODO" : "DONE";
    await db.$transaction((tx) => transitionTask(tx, task!, to, null, { ...(action === "reopen" ? { title, description } : {}), position: 0 }));
    changed = task!.id;
  }
  if (!changed) return;
  await syncProjectProgress(project.id);
  void pushTaskIssues([changed]).catch((err) => console.error("[lighthouse]", project.id, err));
}

async function run(projectId: string, force: boolean): Promise<void> {
  const ctx = await context(projectId);
  if (!ctx?.project.lighthouse) return;
  const { cache } = ctx;
  const now = new Date();
  // Nur solange der Check an ist – ein Abgleich, der beim Ausschalten noch läuft, schreibt nichts mehr
  const save = (data: Prisma.RepoCacheUpdateManyMutationInput) => db.repoCache.updateMany({ where: { projectId, project: { lighthouse: true } }, data });
  if (!ctx.url) {
    await save({ lhError: tk("lighthouse", "errors.noLiveUrl"), lhFetchedAt: now });
    return;
  }

  // 1. Workflow-Datei – einmal am Tag (und nach einer neuen Live-Adresse) prüfen
  let status = cache.lhStatus;
  if (force || !cache.lhInstalledAt || now.getTime() - cache.lhInstalledAt.getTime() > DAY) {
    try {
      const result = await ensureWorkflow(ctx, ctx.url);
      if (result === "removed") {
        await db.project.update({ where: { id: projectId }, data: { lighthouse: false } });
        await save(CLEARED);
        return;
      }
      if (result === "created" || result === "updated" || !status || status === "noPermission") status = "waiting";
      await save({ lhInstalledAt: now, lhStatus: status, lhError: null });
    } catch (err) {
      const e = installError(err);
      await save({ lhInstalledAt: now, lhError: e.error, ...(e.status ? { lhStatus: e.status } : {}) });
      return;
    }
  }
  if (status === "noPermission") return;

  // 2. Jüngster Lauf – solange er aussteht bei jedem Abgleich, danach stündlich
  const settled = status === "done" || status === "failed";
  if (!force && settled && cache.lhFetchedAt && now.getTime() - cache.lhFetchedAt.getTime() < POLL_MS) return;
  try {
    const latest = await latestWorkflowRun(ctx.target, LH_FILE);
    if (!latest) {
      await save({ lhFetchedAt: now, lhStatus: "waiting" });
      return;
    }
    if (latest.status !== "completed") {
      await save({ lhFetchedAt: now, lhStatus: "running", lhRunUrl: latest.html_url });
      return;
    }
    const runAt = new Date(latest.updated_at);
    if (latest.conclusion !== "success") {
      await save({ lhFetchedAt: now, lhStatus: "failed", lhRunUrl: latest.html_url, lhRunAt: runAt, lhError: tk("check", "errors.runFailed", { conclusion: latest.conclusion ?? "?" }) });
      return;
    }
    if (status === "done" && cache.lhRunUrl === latest.html_url && cache.lhReport) {
      await save({ lhFetchedAt: now });
      return;
    }
    const report = parseLighthouseReport(await artifactJson(ctx.target, latest.id, LH_ARTIFACT, LH_REPORT_FILE, MAX_ARTIFACT));
    const baseline = readBaseline(cache.lhBaseline);
    const hasScores = Object.keys(report.scores).length > 0;
    await save({
      lhFetchedAt: now,
      lhStatus: "done",
      lhRunUrl: latest.html_url,
      lhRunAt: runAt,
      lhReport: report as unknown as Prisma.InputJsonValue,
      // Ohne Werte (Seite nicht geladen) bleibt der Maßstab, wie er ist
      ...(hasScores ? { lhBaseline: nextBaseline(report, baseline) as Prisma.InputJsonValue } : {}),
      lhError: null,
    });
    if (hasScores || report.tools.lychee) await syncLighthouseTask(ctx, report, baseline).catch((err) => console.error("[lighthouse-task]", projectId, err));
  } catch (err) {
    await save({ lhFetchedAt: now, lhError: err instanceof GitError ? err.message : tk("git", "errors.unreachable") });
  }
}

const running = new Map<string, Promise<void>>();

/** Beim Git-Abgleich: einrichten, Lauf abfragen, Bericht holen – je Projekt nur einmal gleichzeitig. */
export function refreshLighthouse(projectId: string, force = false): Promise<void> {
  const active = running.get(projectId);
  if (active) return active;
  const job = run(projectId, force).finally(() => running.delete(projectId));
  running.set(projectId, job);
  return job;
}

/** „Jetzt prüfen“. Wirft GitError. */
export async function startLighthouse(projectId: string): Promise<void> {
  const ctx = await context(projectId);
  if (!ctx) throw new GitError(tk("check", "errors.needToken"));
  if (!ctx.project.lighthouse) throw new GitError(tk("lighthouse", "errors.off"));
  if (!ctx.url) throw new GitError(tk("lighthouse", "errors.noLiveUrl"));
  await refreshLighthouse(projectId, true);
  const fresh = await db.repoCache.findUnique({ where: { projectId }, select: { lhStatus: true, lhError: true } });
  if (fresh?.lhStatus === "noPermission") throw new GitError(fresh.lhError ?? tk("check", "errors.noPermission"));
  if (fresh?.lhStatus === "running") return;
  await dispatchWorkflow(ctx.target, LH_FILE);
  await db.repoCache.update({ where: { projectId }, data: { lhStatus: "waiting", lhFetchedAt: new Date(), lhError: null } });
}

/** Ein- oder ausschalten. Aus: die eigene Datei aus dem Repository nehmen (eine angepasste bleibt). */
export async function setLighthouse(projectId: string, enabled: boolean): Promise<{ removed: boolean; error: string | null }> {
  await db.project.update({ where: { id: projectId }, data: { lighthouse: enabled } });
  await db.repoCache.updateMany({ where: { projectId }, data: enabled ? CLEARED : { ...CLEARED, lhBaseline: Prisma.DbNull } });
  if (enabled) {
    void refreshLighthouse(projectId, true).catch((err) => console.error("[lighthouse]", projectId, err));
    return { removed: false, error: null };
  }
  const ctx = await context(projectId);
  if (!ctx) return { removed: false, error: null };
  try {
    const current = await readWorkflow(ctx.target);
    if (!current?.text.startsWith(LH_MARKER)) return { removed: false, error: null };
    await deleteRepoFile(ctx.target, LH_PATH, current.sha, "VibeWorks: Lighthouse-Check entfernen");
    return { removed: true, error: null };
  } catch (err) {
    return { removed: false, error: installError(err).error };
  }
}

type LhFields = Pick<RepoCache, "lhStatus" | "lhReport" | "lhBaseline" | "lhRunUrl" | "lhRunAt" | "lhFetchedAt" | "lhError">;

/** Nur für Projektmitglieder. */
export function serializeLighthouse(enabled: boolean, liveUrl: string | null, c: LhFields | null) {
  return {
    enabled,
    liveUrl: safeLiveUrl(liveUrl),
    status: (c?.lhStatus ?? null) as LhStatus | null,
    report: c?.lhReport ? parseLighthouseReport(c.lhReport) : null,
    baseline: readBaseline(c?.lhBaseline),
    runUrl: c?.lhRunUrl ?? null,
    runAt: c?.lhRunAt?.toISOString() ?? null,
    fetchedAt: c?.lhFetchedAt?.toISOString() ?? null,
    error: c?.lhError ?? null,
  };
}
export type LighthouseView = ReturnType<typeof serializeLighthouse>;
