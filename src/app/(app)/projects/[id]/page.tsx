import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { visibleTo, type ProjectAccess } from "@/lib/access";
import { projectListSelect, serializeProject } from "@/lib/projects";
import { NOTE_ORDER, serializeNote } from "@/lib/notes";
import { serializeTask, TASK_ORDER } from "@/lib/tasks";
import { serializeRepoCache } from "@/lib/git/sync";
import { accountTokenFor } from "@/lib/git/token";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { GitPanel } from "@/components/git/GitPanel";
import { AutoRefresh } from "@/lib/client/useAutoRefresh";
import { analyzeProgress, progressInput } from "@/lib/progress";
import { liveStats } from "@/lib/monitor/stats";
import { LivePanel } from "@/components/live/LivePanel";
import { CostPanel } from "@/components/costs/CostPanel";
import { serializeCost } from "@/lib/costs";
import { sumSeconds } from "@/lib/timeServer";
import { DepsPanel } from "@/components/git/DepsPanel";
import type { DepsReport } from "@/lib/git/depsLogic";
import { dayKey } from "@/lib/utils";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ teilen?: string }> };

const loadProject = cache(async (id: string) => {
  const user = await requirePageUser();
  const project = await db.project.findFirst({
    where: { id, ...visibleTo(user.id) },
    select: {
      ...projectListSelect,
      description: true,
      repoTokenHint: true,
      issueSync: true,
      repoCache: true,
      liveCheckedAt: true,
      liveError: true,
      ownerId: true,
      owner: { select: { username: true, displayName: true } },
      members: { where: { userId: user.id }, select: { role: true } },
      accessRequests: { where: { status: "PENDING" }, select: { id: true } },
      notes: { orderBy: NOTE_ORDER },
      tasks: { orderBy: TASK_ORDER },
      costs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return null;
  const access: ProjectAccess = project.ownerId === user.id ? "OWNER" : (project.members[0]?.role ?? "VIEWER");
  return { project, access };
});

export async function generateMetadata({ params }: Props) {
  const loaded = await loadProject((await params).id);
  return { title: loaded?.project.name ?? (await getT("projects"))("page.fallbackTitle") };
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const [loaded, settings, query] = await Promise.all([loadProject((await params).id), getSettings(), searchParams]);
  if (!loaded) notFound();
  const { project, access } = loaded;
  const { notes, tasks, costs, repoTokenHint, issueSync, repoCache, ownerId: _ownerId, owner, members: _members, accessRequests, liveCheckedAt, liveError, ...rest } = project;
  const [live, timeSeconds] = await Promise.all([project.liveUrl ? liveStats(project.id) : null, sumSeconds({ projectId: project.id })]);
  const done = tasks.filter((t) => t.status === "DONE").length;
  // Automatischer Fortschritt: Analyse für „Wie berechnet?“ – und nachziehen,
  // falls der gespeicherte Wert noch aus der alten Berechnung stammt
  let analysis = null;
  if (project.progressFromTasks) {
    const counts = { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 0 };
    for (const t of tasks) counts[t.status]++;
    analysis = analyzeProgress(progressInput({ ...project, notes: notes.length, tasks: counts, repoCache }));
    if (analysis.progress !== project.progress) {
      await db.$executeRaw`UPDATE "Project" SET "progress" = ${analysis.progress} WHERE "id" = ${project.id}`;
      rest.progress = analysis.progress;
    }
  }
  const isOwner = access === "OWNER";
  const readOnly = access === "VIEWER";
  const account = isOwner ? await accountTokenFor(project.ownerId, project.repoUrl) : null;
  return (
    <div className="space-y-6">
      <ProjectHeader
        initial={serializeProject({ ...rest, repoCache }, done)}
        access={access}
        ownerName={displayNameOf(owner)}
        pendingRequests={isOwner ? accessRequests.length : 0}
        openShare={query.teilen === "1"}
        analysis={analysis}
        timeSeconds={timeSeconds}
      />
      {project.liveUrl && live && (
        <LivePanel
          projectId={project.id}
          canCheck={!readOnly}
          today={dayKey(new Date())}
          stats={live}
          info={{
            url: project.liveUrl,
            state: project.liveState === "up" || project.liveState === "down" ? project.liveState : null,
            ms: project.liveMs,
            since: project.liveSince?.toISOString() ?? null,
            checkedAt: liveCheckedAt?.toISOString() ?? null,
            error: liveError,
            sslExpiresAt: project.sslExpiresAt?.toISOString() ?? null,
          }}
        />
      )}
      <TaskBoard projectId={project.id} initial={tasks.map(serializeTask)} limit={settings.taskColumnLimit} progressFromTasks={project.progressFromTasks} readOnly={readOnly} />
      <NotesPanel projectId={project.id} initial={notes.map(serializeNote)} readOnly={readOnly} />
      <CostPanel projectId={project.id} initial={costs.map(serializeCost)} today={dayKey(new Date())} canEdit={!readOnly} />
      <GitPanel
        projectId={project.id}
        repoUrl={project.repoUrl}
        initialCache={repoCache ? serializeRepoCache(repoCache) : null}
        initialAccess={{
          tokenHint: isOwner ? repoTokenHint : null,
          issueSync,
          accountToken: account ? { hint: account.hint, login: account.login } : null,
        }}
        linkedIssues={tasks.filter((t) => t.issueNumber !== null).length}
        mode={isOwner ? "owner" : "member"}
      />
      {project.repoUrl && repoCache?.provider && (
        <DepsPanel projectId={project.id} initial={(repoCache.deps as unknown as DepsReport | null) ?? null} canCheck={!readOnly} />
      )}
      <AutoRefresh />
    </div>
  );
}
