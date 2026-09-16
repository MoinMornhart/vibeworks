import { db } from "@/lib/db";
import { grepImportsViaGit, listFilesViaGit } from "@/lib/git/gitCli";
import { ensureCodeCopy, projectBranches } from "@/lib/git/codeCopy";
import { tk } from "@/lib/i18n/messages";
import { buildCodeGraph, type CodeGraph } from "./codeGraphLogic";

// Code-Netz eines Projekts (#57, #60) aus der lokalen Code-Kopie – kein
// KI-Dienst, keine Kosten. Das Netz hängt nur am Commit, deshalb merkt sich
// der Server es je Projekt und Zweig bis zum nächsten.

const cache = new Map<string, { head: string; graph: CodeGraph }>();

export interface CodeMemoView {
  id: string;
  file: string;
  text: string;
  author: string | null;
  via: string;
  at: string;
}

export interface ProjectCodeGraph extends CodeGraph {
  branch: string | null;
  /** Hauptzweig laut Abgleich */
  defaultBranch: string | null;
  branches: string[];
  commit: string | null;
  webUrl: string;
  /** Keine Kopie – erst den Repo-Abgleich laufen lassen (oder das Holen scheiterte) */
  empty: boolean;
  error: string | null;
  /** Netz aus einer älteren Kopie – der neueste Stand ließ sich nicht holen */
  staleError: string | null;
  memos: CodeMemoView[];
}

export async function projectMemos(projectId: string): Promise<CodeMemoView[]> {
  const rows = await db.codeMemo.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 300 });
  return rows.map((m) => ({ id: m.id, file: m.file, text: m.text, author: m.authorName, via: m.via, at: m.createdAt.toISOString() }));
}

export async function projectCodeGraph(projectId: string, wantedBranch?: string | null, opts: { branches?: boolean; refresh?: boolean } = {}): Promise<ProjectCodeGraph> {
  const repo = await db.repoCache.findUnique({ where: { projectId }, select: { defaultBranch: true, webUrl: true } });
  const copy = await ensureCodeCopy(projectId, wantedBranch, { force: opts.refresh });
  const key = `${projectId}:${copy.branch}`;
  let graph = copy.head && cache.get(key)?.head === copy.head ? cache.get(key)!.graph : null;
  if (!graph) {
    const files = copy.head ? await listFilesViaGit(projectId, copy.branch) : [];
    graph = files.length ? buildCodeGraph(await grepImportsViaGit(projectId, copy.branch), files) : { nodes: [], edges: [], files: 0, hidden: 0 };
    if (files.length && copy.head) cache.set(key, { head: copy.head, graph });
  }
  const [branches, memos] = await Promise.all([opts.branches ? projectBranches(projectId) : Promise.resolve([]), projectMemos(projectId)]);
  return {
    ...graph,
    branch: copy.branch,
    defaultBranch: repo?.defaultBranch ?? null,
    branches,
    commit: copy.head,
    webUrl: repo?.webUrl ?? "",
    empty: graph.files === 0,
    error: graph.files === 0 ? (copy.error ?? (copy.head ? tk("graph", "errors.noFiles") : tk("graph", "errors.notSynced"))) : null,
    staleError: graph.files > 0 ? copy.error : null,
    memos,
  };
}
