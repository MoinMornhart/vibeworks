import type { Prisma, ProjectStatus } from "@prisma/client";
import type { CiState } from "@/lib/git/ci";
import { db } from "./db";
import { slugify } from "./utils";

// Projekte gehören genau einem Konto. Jede Abfrage filtert auf den Besitzer;
// fremde IDs verhalten sich wie nicht vorhandene.

export const projectListSelect = {
  id: true,
  name: true,
  slug: true,
  summary: true,
  status: true,
  priority: true,
  progress: true,
  accent: true,
  tags: true,
  favorite: true,
  position: true,
  progressFromTasks: true,
  repoUrl: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { notes: true, tasks: true } },
  // Nur der CI-Zustand – für den Punkt auf der Projektkarte
  repoCache: { select: { ci: true } },
} satisfies Prisma.ProjectSelect;

export type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof projectListSelect }>;

/** Für den Client: Datumsfelder als ISO-Strings, Zähler flach. */
export function serializeProject<T extends ProjectListRow>(p: T, tasksDone = 0) {
  const { _count, createdAt, updatedAt, repoCache, ...rest } = p;
  return {
    ...rest,
    ci: ((repoCache?.ci as { state?: CiState } | null)?.state ?? null) as CiState | null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    notes: _count.notes,
    tasks: _count.tasks,
    tasksDone,
  };
}

/** Erledigte Aufgaben je Projekt – für „3/8“ auf den Karten. */
export async function taskDoneCounts(ownerId: string): Promise<Map<string, number>> {
  const rows = await db.task.groupBy({
    by: ["projectId"],
    where: { status: "DONE", project: { ownerId } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.projectId, r._count._all]));
}
export type ProjectListItem = ReturnType<typeof serializeProject<ProjectListRow>> & { description?: string | null };
export type ProjectDetail = ProjectListItem & { description: string | null };

/** Freier Slug je Besitzer: „mein-projekt“, „mein-projekt-2“ … */
export async function uniqueSlug(ownerId: string, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (
      await db.project.findMany({
        where: { ownerId, slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      })
    ).map((p) => p.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function nextPosition(ownerId: string, status: ProjectStatus): Promise<number> {
  const last = await db.project.findFirst({ where: { ownerId, status }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? -1) + 1;
}

export async function findOwnProject(ownerId: string, id: string) {
  return db.project.findFirst({ where: { id, ownerId } });
}
