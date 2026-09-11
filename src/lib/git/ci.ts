import type { GitProvider, ParsedRepo } from "./parse";
import { apiBase, authHeaders, request } from "./providers";

// CI-Status des Hauptzweigs: GitHub Actions, GitLab-Pipelines und
// Commit-Status (Gitea/Forgejo, bei GitHub auch externe CI). Alles wird auf
// fünf Zustände gebracht; je Workflow zählt nur sein jüngster Lauf.

export const CI_STATES = ["success", "failure", "running", "pending", "canceled"] as const;
export type CiState = (typeof CI_STATES)[number];

export interface CiRun {
  name: string;
  state: CiState;
  url: string | null;
  updatedAt: string;
}

export interface CiStatus {
  state: CiState;
  runs: CiRun[];
  sha: string | null;
  checkedAt: string;
}

export function githubRunState(status: string, conclusion: string | null): CiState {
  if (status !== "completed") return ["queued", "waiting", "requested", "pending"].includes(status) ? "pending" : "running";
  if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") return "success";
  if (conclusion === "cancelled" || conclusion === "stale") return "canceled";
  return "failure"; // failure, timed_out, action_required, startup_failure …
}

export function gitlabPipelineState(status: string): CiState {
  if (status === "success") return "success";
  if (status === "failed") return "failure";
  if (status === "running") return "running";
  if (status === "canceled" || status === "skipped") return "canceled";
  return "pending"; // created, pending, preparing, scheduled, manual, waiting_for_resource
}

export function commitStatusState(status: string): CiState {
  if (status === "success" || status === "warning") return "success";
  if (status === "failure" || status === "error") return "failure";
  return "pending";
}

/** Gesamtzustand: ein Fehlschlag färbt rot, sonst läuft, wartet, grün, abgebrochen. */
export function overallState(runs: CiRun[]): CiState | null {
  if (!runs.length) return null;
  const has = (s: CiState) => runs.some((r) => r.state === s);
  if (has("failure")) return "failure";
  if (has("running")) return "running";
  if (has("pending")) return "pending";
  if (has("success")) return "success";
  return "canceled";
}

/** Je Name nur den jüngsten Lauf behalten, neueste zuerst. */
export function latestPerName(runs: CiRun[], max = 5): CiRun[] {
  const seen = new Set<string>();
  return [...runs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)))
    .slice(0, max);
}

interface GhRun { name: string | null; display_title?: string; status: string; conclusion: string | null; html_url: string; updated_at: string; head_sha: string }
interface CommitStatusEntry { context: string; state?: string; status?: string; target_url: string | null; updated_at: string }
interface CombinedStatus { state: string; statuses: CommitStatusEntry[] | null }
interface GlPipeline { id: number; iid?: number; status: string; web_url: string; updated_at: string; sha: string }

async function commitStatuses(url: string, headers: Record<string, string>): Promise<CiRun[]> {
  const res = await request<CombinedStatus>("GET", url, headers);
  return (res?.statuses ?? []).map((s) => ({
    name: s.context,
    state: commitStatusState(s.state ?? s.status ?? "pending"),
    url: s.target_url || null,
    updatedAt: s.updated_at,
  }));
}

/** CI des Hauptzweigs; null, wenn das Repository keine CI hat. Wirft bei Netzfehlern. */
export async function fetchCi(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null, headSha: string | null): Promise<CiStatus | null> {
  const api = apiBase(provider, repo);
  const headers = authHeaders(provider, token);
  let runs: CiRun[] = [];

  if (provider === "github") {
    if (branch) {
      // Actions können abgeschaltet sein (404) – dann bleibt der Commit-Status.
      const res = await request<{ workflow_runs: GhRun[] }>("GET", `${api}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=20`, headers).catch(() => null);
      const all = res?.workflow_runs ?? [];
      const sha = headSha ?? all[0]?.head_sha;
      const onHead = all.filter((r) => r.head_sha === sha);
      runs = (onHead.length ? onHead : all).map((r) => ({
        name: r.name ?? r.display_title ?? "Workflow",
        state: githubRunState(r.status, r.conclusion),
        url: r.html_url,
        updatedAt: r.updated_at,
      }));
    }
    if (!runs.length && headSha) runs = await commitStatuses(`${api}/commits/${headSha}/status`, headers);
    if (!runs.length) return null;
    const latest = latestPerName(runs, 20);
    return { state: overallState(latest)!, runs: latest.slice(0, 5), sha: headSha, checkedAt: new Date().toISOString() };
  }

  if (provider === "gitlab") {
    if (!branch) return null;
    const list = await request<GlPipeline[]>("GET", `${api}/pipelines?ref=${encodeURIComponent(branch)}&per_page=5`, headers);
    runs = (list ?? []).map((p) => ({ name: `Pipeline #${p.iid ?? p.id}`, state: gitlabPipelineState(p.status), url: p.web_url, updatedAt: p.updated_at }));
    // Eine Pipeline ist schon der ganze Lauf – maßgeblich ist die jüngste.
    return runs.length ? { state: runs[0].state, runs, sha: list[0]?.sha ?? headSha, checkedAt: new Date().toISOString() } : null;
  }

  if (!headSha) return null;
  runs = await commitStatuses(`${api}/commits/${headSha}/status`, headers);
  if (!runs.length) return null;
  const latest = latestPerName(runs, 20);
  return { state: overallState(latest)!, runs: latest.slice(0, 5), sha: headSha, checkedAt: new Date().toISOString() };
}
