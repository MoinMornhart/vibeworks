import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { listFilesViaGit, localHeadViaGit } from "@/lib/git/gitCli";
import { applyStructure, missingPaths, readStructure, suggestAreas, type ProjectStructure, type StructureInput } from "@/lib/projectStructureLogic";

// Projektaufbau (#101) mit Datenbank und lokaler Repository-Kopie.

/** Dateien der lokalen Kopie – null, wenn es (noch) keine gibt. */
async function repoFiles(projectId: string): Promise<string[] | null> {
  const cache = await db.repoCache.findUnique({ where: { projectId }, select: { defaultBranch: true } });
  const branch = cache?.defaultBranch ?? null;
  if (!branch || !(await localHeadViaGit(projectId, branch))) return null;
  return listFilesViaGit(projectId, branch);
}

export interface StructureView extends ProjectStructure {
  /** Pfade der Tabelle, die es im Repository nicht gibt */
  missingPaths: string[];
  /** Ordner aus dem Repository als Ausgangspunkt */
  suggestedAreas: Array<{ path: string; files: number }>;
  /** Gibt es eine lokale Kopie zum Abgleich? */
  checked: boolean;
}

export async function structureView(projectId: string): Promise<StructureView> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { structure: true } });
  const structure = readStructure(project?.structure);
  const files = await repoFiles(projectId).catch(() => null);
  return {
    ...structure,
    missingPaths: files ? missingPaths(structure.rows, files) : [],
    suggestedAreas: files ? suggestAreas(files) : [],
    checked: files !== null,
  };
}

export async function saveStructure(projectId: string, input: StructureInput, by: string): Promise<StructureView> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { structure: true } });
  let next: ProjectStructure;
  try {
    next = applyStructure(readStructure(project?.structure), input, by);
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Invalid structure");
  }
  await db.project.update({ where: { id: projectId }, data: { structure: next as unknown as Prisma.InputJsonValue } });
  return structureView(projectId);
}
