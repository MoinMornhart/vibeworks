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
      ownerId: true,
      owner: { select: { username: true, displayName: true } },
      members: { where: { userId: user.id }, select: { role: true } },
      accessRequests: { where: { status: "PENDING" }, select: { id: true } },
      notes: { orderBy: NOTE_ORDER },
      tasks: { orderBy: TASK_ORDER },
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
  const { notes, tasks, repoTokenHint, issueSync, repoCache, ownerId: _ownerId, owner, members: _members, accessRequests, ...rest } = project;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const isOwner = access === "OWNER";
  const readOnly = access === "VIEWER";
  const account = isOwner ? await accountTokenFor(project.ownerId, project.repoUrl) : null;
  return (
    <div className="space-y-6">
      <ProjectHeader
        initial={serializeProject(rest, done)}
        access={access}
        ownerName={displayNameOf(owner)}
        pendingRequests={isOwner ? accessRequests.length : 0}
        openShare={query.teilen === "1"}
      />
      <TaskBoard projectId={project.id} initial={tasks.map(serializeTask)} limit={settings.taskColumnLimit} progressFromTasks={project.progressFromTasks} readOnly={readOnly} />
      <NotesPanel projectId={project.id} initial={notes.map(serializeNote)} readOnly={readOnly} />
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
      <AutoRefresh />
    </div>
  );
}
