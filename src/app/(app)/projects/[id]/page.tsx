import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject } from "@/lib/projects";
import { NOTE_ORDER, serializeNote } from "@/lib/notes";
import { serializeTask, TASK_ORDER } from "@/lib/tasks";
import { serializeRepoCache } from "@/lib/git/sync";
import { getSettings } from "@/lib/settings";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { GitPanel } from "@/components/git/GitPanel";
import { AutoRefresh } from "@/lib/client/useAutoRefresh";

type Props = { params: Promise<{ id: string }> };

const loadProject = cache(async (id: string) => {
  const user = await requirePageUser();
  return db.project.findFirst({
    where: { id, ownerId: user.id },
    select: {
      ...projectListSelect,
      description: true,
      repoTokenHint: true,
      issueSync: true,
      repoCache: true,
      notes: { orderBy: NOTE_ORDER },
      tasks: { orderBy: TASK_ORDER },
    },
  });
});

export async function generateMetadata({ params }: Props) {
  const project = await loadProject((await params).id);
  return { title: project?.name ?? "Projekt" };
}

export default async function ProjectPage({ params }: Props) {
  const [project, settings] = await Promise.all([loadProject((await params).id), getSettings()]);
  if (!project) notFound();
  const { notes, tasks, repoTokenHint, issueSync, repoCache, ...rest } = project;
  const done = tasks.filter((t) => t.status === "DONE").length;
  return (
    <div className="space-y-6">
      <ProjectHeader initial={serializeProject(rest, done)} />
      <TaskBoard projectId={project.id} initial={tasks.map(serializeTask)} limit={settings.taskColumnLimit} progressFromTasks={project.progressFromTasks} />
      <NotesPanel projectId={project.id} initial={notes.map(serializeNote)} />
      <GitPanel
        projectId={project.id}
        repoUrl={project.repoUrl}
        initialCache={repoCache ? serializeRepoCache(repoCache) : null}
        initialAccess={{ tokenHint: repoTokenHint, issueSync }}
        linkedIssues={tasks.filter((t) => t.issueNumber !== null).length}
      />
      <AutoRefresh />
    </div>
  );
}
