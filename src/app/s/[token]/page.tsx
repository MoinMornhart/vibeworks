import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, CircleDot, Eye, GitBranch, LogIn, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { currentUser, displayNameOf } from "@/lib/auth/guard";
import { serializeRepoCache } from "@/lib/git/sync";
import { TASK_ORDER } from "@/lib/tasks";
import { formatDue, isFaded } from "@/lib/taskDates";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP, TASK_STATUSES, priorityLabel } from "@/lib/status";
import { dayKey } from "@/lib/utils";
import { getLocale, getT } from "@/lib/i18n/server";
import { Markdown } from "@/components/Markdown";
import { GitPanel } from "@/components/git/GitPanel";
import { AccessRequestBox } from "@/components/share/AccessRequestBox";

// Öffentliche Nur-Lesen-Ansicht eines geteilten Projekts – ohne Anmeldung
// erreichbar (siehe Middleware). Notizen bleiben Mitgliedern vorbehalten.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

const load = cache(async (token: string) => {
  if (!TOKEN_RE.test(token)) return null;
  return db.project.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      summary: true,
      description: true,
      status: true,
      priority: true,
      progress: true,
      accent: true,
      tags: true,
      repoUrl: true,
      issueSync: true,
      ownerId: true,
      owner: { select: { username: true, displayName: true } },
      members: { select: { userId: true } },
      tasks: { orderBy: TASK_ORDER },
      repoCache: true,
    },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [project, t] = await Promise.all([params.then((p) => load(p.token)), getT("share")]);
  return { title: project ? t("public.metaTitle", { name: project.name }) : t("public.invalidLink"), robots: { index: false, follow: false } };
}

const COLUMN_COLOR: Record<string, string> = { TODO: "var(--vw-muted)", DOING: "var(--vw-accent)", BLOCKED: "#f87171", DONE: "#34d399" };

export default async function SharedProjectPage({ params }: Props) {
  const { token } = await params;
  const project = await load(token);
  if (!project) notFound();

  const [t, ts, locale] = await Promise.all([getT("share"), getT("status"), getLocale()]);
  const user = await currentUser().catch(() => null);
  const isMember = !!user && (project.ownerId === user.id || project.members.some((m) => m.userId === user.id));
  const request =
    user && !isMember ? await db.accessRequest.findUnique({ where: { projectId_userId: { projectId: project.id, userId: user.id } }, select: { status: true } }) : null;

  const accent = PROJECT_ACCENTS[project.accent] ?? PROJECT_ACCENTS.violet;
  const status = PROJECT_STATUS_MAP[project.status];
  const now = Date.now();
  const today = dayKey(new Date());
  const tasks = project.tasks.filter((t) => !isFaded({ status: t.status, statusChangedAt: t.statusChangedAt.toISOString() }, now));
  const done = project.tasks.filter((t) => t.status === "DONE").length;
  const loginHref = `/login?next=${encodeURIComponent(`/s/${token}`)}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-6 sm:px-5 sm:py-8">
      <header className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={isMember ? "/" : loginHref} className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches SVG-Logo */}
          <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
          {config.appName}
        </Link>
        <div className="flex items-center gap-2">
          <span className="chip !py-0.5 text-xs"><Eye size={13} /> {t("public.readOnly")}</span>
          {isMember ? (
            <Link href={`/projects/${project.id}`} className="btn btn-primary btn-sm">{t("public.toProject")} <ArrowRight size={14} /></Link>
          ) : !user ? (
            <Link href={loginHref} className="btn btn-sm"><LogIn size={14} /> {t("public.signIn")}</Link>
          ) : null}
        </div>
      </header>

      <section className="glass relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
        <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1>
        {project.summary && <p className="mt-2 text-lg text-muted">{project.summary}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="chip !py-0.5" style={{ color: `var(${status.cssVar})` }}>
            <span className="h-2 w-2 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${project.status}`)}
          </span>
          <span className="text-muted">{t("public.priority", { label: priorityLabel(project.priority, locale) })}</span>
          <span className="inline-flex items-center gap-1.5 text-muted"><UserRound size={14} /> {t("public.sharedBy", { name: displayNameOf(project.owner) })}</span>
          {project.repoUrl && !project.repoUrl.startsWith("git@") && (
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
              <GitBranch size={14} /> {project.repoUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        <div className="mt-6 max-w-xl">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">{t("public.progress")}</span>
            <span className="font-semibold tabular-nums">{project.progress} %</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
          </div>
        </div>
        {project.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <span key={t} className="chip">#{t}</span>
            ))}
          </div>
        )}
      </section>

      {user && !isMember && <AccessRequestBox token={token} initialStatus={request?.status === "PENDING" || request?.status === "DENIED" ? request.status : null} />}
      {!user && (
        <p className="glass px-5 py-4 text-sm text-muted">
          {t("public.collaborate")} <Link href={loginHref} className="text-accent-ink hover:underline">{t("public.signInLink")}</Link> {t("public.askOwner")}
        </p>
      )}

      {project.description && (
        <section className="glass p-6 sm:p-8">
          <h2 className="mb-3 text-lg font-semibold">{t("public.description")}</h2>
          <Markdown>{project.description}</Markdown>
        </section>
      )}

      <section className="glass p-6 sm:p-8" aria-labelledby="shared-tasks">
        <h2 id="shared-tasks" className="mb-5 flex items-center gap-2 text-lg font-semibold">
          {t("public.tasks")}
          {project.tasks.length > 0 && <span className="rounded-full bg-fg/10 px-2 text-xs font-normal tabular-nums text-muted">{t("public.doneCount", { done, total: project.tasks.length })}</span>}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((s) => {
            const list = tasks.filter((t) => t.status === s.value);
            const label = ts(`task.${s.value}`);
            return (
              <div key={s.value} className="flex min-w-0 flex-col rounded-2xl border bg-bg/25 p-2.5" role="group" aria-label={label}>
                <h3 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLOR[s.value] }} />
                  {label}
                  <span className="ml-auto text-xs font-normal tabular-nums text-muted">{list.length}</span>
                </h3>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted">{t("public.noTasks")}</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((t) => (
                      <li key={t.id} className="glass !rounded-xl p-2.5 text-sm">
                        <p className={t.status === "DONE" ? "break-words text-muted line-through" : "break-words"}>{t.title}</p>
                        {(t.dueDate || t.labels.length > 0 || t.issueUrl) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                            {t.issueNumber && t.issueUrl && (
                              <a href={t.issueUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded-md border px-1.5 font-mono hover:text-fg">
                                <CircleDot size={11} /> #{t.issueNumber}
                              </a>
                            )}
                            {t.dueDate && <span className="rounded-md border px-1.5">{formatDue(dayKey(t.dueDate), today, locale)}</span>}
                            {t.labels.slice(0, 3).map((l) => (
                              <span key={l} className="rounded-md bg-fg/10 px-1.5">{l}</span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {project.repoCache && (
        <GitPanel
          projectId={project.id}
          repoUrl={project.repoUrl}
          initialCache={serializeRepoCache(project.repoCache)}
          initialAccess={{ tokenHint: null, issueSync: project.issueSync }}
          linkedIssues={project.tasks.filter((t) => t.issueNumber !== null).length}
          mode="public"
        />
      )}

      <footer className="pb-4 text-center text-xs text-muted">
        {t("public.footer", { app: config.appName })}
      </footer>
    </div>
  );
}
