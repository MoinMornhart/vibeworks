import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { visibleTo } from "@/lib/access";
import { buildSlides } from "@/lib/slidesLogic";
import { getT } from "@/lib/i18n/server";
import { SlideDeck } from "@/components/slides/SlideDeck";

// Vorstellungs-Folien eines Projekts – nur für Projektmitglieder.

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const user = await requirePageUser();
  return db.project.findFirst({
    where: { id, ...visibleTo(user.id) },
    select: {
      id: true,
      name: true,
      summary: true,
      description: true,
      status: true,
      progress: true,
      accent: true,
      tags: true,
      liveUrl: true,
      repoUrl: true,
      coverUploadId: true,
      owner: { select: { username: true, displayName: true } },
      repoCache: { select: { commits: true } },
      tasks: { where: { status: { in: ["TODO", "DOING"] } }, orderBy: [{ status: "desc" }, { position: "asc" }], take: 6, select: { title: true } },
    },
  });
}

export async function generateMetadata({ params }: Props) {
  const project = await load((await params).id);
  return { title: project ? (await getT("slides"))("metaTitle", { name: project.name }) : "404" };
}

export default async function SlidesPage({ params }: Props) {
  const project = await load((await params).id);
  if (!project) notFound();
  const groups = await db.task.groupBy({ by: ["status"], where: { projectId: project.id }, _count: { _all: true } });
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const commits = ((project.repoCache?.commits as Array<{ title: string; author: string; date: string }> | null) ?? []).map((c) => ({ title: c.title, author: c.author, date: c.date }));
  const slides = buildSlides({
    name: project.name,
    summary: project.summary,
    description: project.description,
    owner: displayNameOf(project.owner),
    status: project.status,
    progress: project.progress,
    tags: project.tags,
    tasks: { todo: count("TODO"), doing: count("DOING"), blocked: count("BLOCKED"), done: count("DONE") },
    nextTasks: project.tasks.map((t) => t.title),
    commits,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    cover: project.coverUploadId ? `/api/uploads/${project.coverUploadId}` : null,
  });
  return <SlideDeck projectId={project.id} slides={slides} accent={project.accent} />;
}
