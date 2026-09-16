import { db } from "@/lib/db";
import { grepImportsViaGit, listFilesViaGit } from "@/lib/git/gitCli";
import { buildCodeGraph, type CodeGraph } from "./codeGraphLogic";

// Code-Netz eines Projekts (#57) aus dem Klon, den VibeWorks beim Abgleich
// ohnehin holt – kein Netzzugriff, keine Kosten. Das Ergebnis hängt nur am
// Commit, deshalb merkt sich der Server es je Projekt bis zum nächsten.

const cache = new Map<string, { key: string; graph: CodeGraph }>();

export interface ProjectCodeGraph extends CodeGraph {
  branch: string | null;
  commit: string | null;
  webUrl: string;
  /** Kein geholter Stand – erst den Repo-Abgleich laufen lassen */
  empty: boolean;
}

export async function projectCodeGraph(projectId: string): Promise<ProjectCodeGraph> {
  const repo = await db.repoCache.findUnique({ where: { projectId }, select: { defaultBranch: true, commits: true, webUrl: true, fetchedAt: true } });
  const branch = repo?.defaultBranch ?? null;
  const commit = ((repo?.commits as unknown as Array<{ sha: string }> | null) ?? [])[0]?.sha ?? null;
  const key = `${branch}:${commit}:${repo?.fetchedAt.getTime() ?? 0}`;
  const hit = cache.get(projectId);
  let graph = hit?.key === key ? hit.graph : null;
  if (!graph) {
    const files = await listFilesViaGit(projectId, branch);
    graph = files.length ? buildCodeGraph(await grepImportsViaGit(projectId, branch), files) : { nodes: [], edges: [], files: 0, hidden: 0 };
    if (files.length) cache.set(projectId, { key, graph });
  }
  return { ...graph, branch, commit, webUrl: repo?.webUrl ?? "", empty: graph.files === 0 };
}
