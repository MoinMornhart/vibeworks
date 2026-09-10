import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject } from "@/lib/projects";
import { ProjectHeader } from "@/components/projects/ProjectHeader";

type Props = { params: Promise<{ id: string }> };

const loadProject = cache(async (id: string) => {
  const user = await requirePageUser();
  return db.project.findFirst({ where: { id, ownerId: user.id }, select: { ...projectListSelect, description: true } });
});

export async function generateMetadata({ params }: Props) {
  const project = await loadProject((await params).id);
  return { title: project?.name ?? "Projekt" };
}

export default async function ProjectPage({ params }: Props) {
  const project = await loadProject((await params).id);
  if (!project) notFound();
  return <ProjectHeader initial={serializeProject(project)} />;
}
