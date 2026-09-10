import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject } from "@/lib/projects";
import { NOTE_ORDER, serializeNote } from "@/lib/notes";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { NotesPanel } from "@/components/notes/NotesPanel";

type Props = { params: Promise<{ id: string }> };

const loadProject = cache(async (id: string) => {
  const user = await requirePageUser();
  return db.project.findFirst({
    where: { id, ownerId: user.id },
    select: { ...projectListSelect, description: true, notes: { orderBy: NOTE_ORDER } },
  });
});

export async function generateMetadata({ params }: Props) {
  const project = await loadProject((await params).id);
  return { title: project?.name ?? "Projekt" };
}

export default async function ProjectPage({ params }: Props) {
  const project = await loadProject((await params).id);
  if (!project) notFound();
  const { notes, ...rest } = project;
  return (
    <div className="space-y-6">
      <ProjectHeader initial={serializeProject(rest)} />
      <NotesPanel projectId={project.id} initial={notes.map(serializeNote)} />
    </div>
  );
}
