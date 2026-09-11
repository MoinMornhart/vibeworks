import { safeFetch, FetchBlockedError } from "@/lib/security/ssrf";
import { tk } from "@/lib/i18n/messages";
import { guessProvider, splitCommitMessage, type GitProvider, type ParsedRepo } from "./parse";

// Zugriff auf GitHub, GitLab und Gitea/Forgejo über deren HTTP-APIs:
// Stammdaten und Commits lesen, Issues anlegen, ändern und abfragen.
// Kein Klonen, kein git auf dem Server.

export class GitError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface RepoSnapshot {
  provider: GitProvider;
  fullName: string;
  webUrl: string;
  defaultBranch: string | null;
  description: string | null;
  stars: number | null;
  commits: CommitInfo[];
}

export interface CommitInfo {
  sha: string;
  title: string;
  body: string;
  author: string;
  date: string;
  url: string | null;
}

const COMMIT_LIMIT = 100;

// Meldungen sind Übersetzungsschlüssel – sie landen in RepoCache.error bzw.
// Task.issueError und werden erst beim Anzeigen in die Sprache übersetzt.
function explain(status: number): string {
  if (status === 401) return tk("git", "errors.unauthorized");
  if (status === 403) return tk("git", "errors.forbidden");
  if (status === 404) return tk("git", "errors.notFound");
  if (status === 410) return tk("git", "errors.issuesDisabled");
  if (status === 422) return tk("git", "errors.rejected");
  if (status === 429) return tk("git", "errors.tooManyRequests");
  return tk("git", "errors.http", { status });
}

async function request<T>(method: string, url: string, headers: Record<string, string>, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await safeFetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": "VibeWorks",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof FetchBlockedError) throw new GitError(err.message);
    if (err instanceof Error && err.name === "TimeoutError") throw new GitError(tk("git", "errors.timeout"));
    throw new GitError(tk("git", "errors.unreachable"));
  }
  if (!res.ok) throw new GitError(explain(res.status), res.status);
  try {
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T; // 204 bei DELETE
  } catch {
    throw new GitError(tk("git", "errors.notJson"));
  }
}

const getJson = <T>(url: string, headers: Record<string, string>) => request<T>("GET", url, headers);

function apiBase(provider: GitProvider, repo: ParsedRepo): string {
  if (provider === "github") return `${repo.host === "github.com" ? "https://api.github.com" : `${repo.origin}/api/v3`}/repos/${repo.path}`;
  if (provider === "gitlab") return `${repo.origin}/api/v4/projects/${encodeURIComponent(repo.path)}`;
  return `${repo.origin}/api/v1/repos/${repo.path}`;
}

function authHeaders(provider: GitProvider, token: string | null): Record<string, string> {
  if (provider === "github") return { "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (!token) return {};
  return provider === "gitlab" ? { "PRIVATE-TOKEN": token } : { Authorization: `token ${token}` };
}

// ── GitHub ──────────────────────────────────────────────────

interface GhRepo { full_name: string; html_url: string; default_branch: string; description: string | null; stargazers_count: number }
interface GhCommit { sha: string; html_url: string; commit: { message: string; author?: { name?: string; date?: string }; committer?: { date?: string } }; author?: { login?: string } | null }

async function github(repo: ParsedRepo, token: string | null): Promise<RepoSnapshot> {
  const api = apiBase("github", repo);
  const headers = authHeaders("github", token);
  const info = await getJson<GhRepo>(api, headers);
  let commits: GhCommit[] = [];
  try {
    commits = await getJson<GhCommit[]>(`${api}/commits?per_page=${COMMIT_LIMIT}&sha=${encodeURIComponent(info.default_branch)}`, headers);
  } catch (err) {
    if (!(err instanceof GitError && err.status === 409)) throw err; // 409 = leeres Repository
  }
  return {
    provider: "github",
    fullName: info.full_name,
    webUrl: info.html_url,
    defaultBranch: info.default_branch,
    description: info.description,
    stars: info.stargazers_count,
    commits: commits.map((c) => ({
      sha: c.sha,
      ...splitCommitMessage(c.commit.message),
      author: c.commit.author?.name || c.author?.login || "unbekannt",
      date: c.commit.author?.date || c.commit.committer?.date || new Date(0).toISOString(),
      url: c.html_url,
    })),
  };
}

// ── GitLab ──────────────────────────────────────────────────

interface GlProject { path_with_namespace: string; web_url: string; default_branch?: string; description: string | null; star_count: number }
interface GlCommit { id: string; message: string; title: string; author_name: string; committed_date?: string; created_at?: string; web_url: string }

async function gitlab(repo: ParsedRepo, token: string | null): Promise<RepoSnapshot> {
  const api = apiBase("gitlab", repo);
  const headers = authHeaders("gitlab", token);
  const info = await getJson<GlProject>(api, headers);
  const commits = info.default_branch
    ? await getJson<GlCommit[]>(`${api}/repository/commits?per_page=${COMMIT_LIMIT}&ref_name=${encodeURIComponent(info.default_branch)}`, headers)
    : [];
  return {
    provider: "gitlab",
    fullName: info.path_with_namespace,
    webUrl: info.web_url,
    defaultBranch: info.default_branch ?? null,
    description: info.description,
    stars: info.star_count,
    commits: commits.map((c) => ({
      sha: c.id,
      ...splitCommitMessage(c.message || c.title),
      author: c.author_name || "unbekannt",
      date: c.committed_date || c.created_at || new Date(0).toISOString(),
      url: c.web_url,
    })),
  };
}

// ── Gitea / Forgejo ─────────────────────────────────────────

interface GtRepo { full_name: string; html_url: string; default_branch: string; description: string; stars_count: number; empty?: boolean }
interface GtCommit { sha: string; html_url: string; commit: { message: string; author?: { name?: string; date?: string } } }

async function gitea(repo: ParsedRepo, token: string | null): Promise<RepoSnapshot> {
  const api = apiBase("gitea", repo);
  const headers = authHeaders("gitea", token);
  const info = await getJson<GtRepo>(api, headers);
  const commits = info.empty
    ? []
    : await getJson<GtCommit[]>(`${api}/commits?limit=50&sha=${encodeURIComponent(info.default_branch)}&stat=false&verification=false&files=false`, headers).catch((err) => {
        if (err instanceof GitError && err.status === 409) return [];
        throw err;
      });
  return {
    provider: "gitea",
    fullName: info.full_name,
    webUrl: info.html_url,
    defaultBranch: info.default_branch,
    description: info.description || null,
    stars: info.stars_count,
    commits: commits.map((c) => ({
      sha: c.sha,
      ...splitCommitMessage(c.commit.message),
      author: c.commit.author?.name || "unbekannt",
      date: c.commit.author?.date || new Date(0).toISOString(),
      url: c.html_url,
    })),
  };
}

const ADAPTERS: Record<GitProvider, (r: ParsedRepo, t: string | null) => Promise<RepoSnapshot>> = { github, gitlab, gitea };

/**
 * Holt Stammdaten und Commits. Ist der Anbieter nicht am Host erkennbar
 * (eigene Instanz unter eigener Domain), wird erst Gitea, dann GitLab
 * versucht.
 */
export async function fetchRepository(repo: ParsedRepo, token: string | null): Promise<RepoSnapshot> {
  const known = guessProvider(repo.host);
  if (known) return ADAPTERS[known](repo, token);
  try {
    return await gitea(repo, token);
  } catch (first) {
    try {
      return await gitlab(repo, token);
    } catch {
      throw first;
    }
  }
}

// ── Issues ──────────────────────────────────────────────────

export interface IssueRef {
  number: number;
  url: string;
  closed: boolean;
  updatedAt: string;
  labels: string[];
}

/** Labels, über die ein offenes Issue in die Spalten „In Arbeit“ bzw. „Blockiert“ fällt. */
export const STATUS_LABELS = { DOING: "in Arbeit", BLOCKED: "blockiert" } as const;
export type StatusLabel = (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS];
const LABEL_COLORS: Record<StatusLabel, string> = { "in Arbeit": "8b5cf6", blockiert: "ef4444" };
const ALL_STATUS_LABELS = Object.values(STATUS_LABELS);
const hasLabel = (labels: string[], name: string) => labels.some((l) => l.toLowerCase() === name.toLowerCase());

export interface IssueInput {
  title: string;
  body: string;
  closed: boolean;
  /** Nur GitHub unterscheidet, warum ein Issue geschlossen wurde. */
  reason?: "completed" | "not_planned";
}

export interface IssueApi {
  create(input: IssueInput): Promise<IssueRef>;
  update(number: number, input: IssueInput): Promise<IssueRef>;
  /** Zuletzt geänderte Issues (offen und geschlossen), neueste zuerst. */
  recent(): Promise<IssueRef[]>;
  /** Genau ein Status-Label setzen (oder keins); fremde Labels bleiben stehen. */
  setStatusLabel(issue: IssueRef, label: StatusLabel | null): Promise<void>;
}

type LabelList = Array<{ name: string } | string> | null | undefined;
const labelNames = (l: LabelList) => (l ?? []).map((x) => (typeof x === "string" ? x : x.name));

interface GhIssue { number: number; html_url: string; state: string; updated_at: string; pull_request?: unknown; labels?: LabelList }
interface GlIssue { iid: number; web_url: string; state: string; updated_at: string; labels?: string[] }
interface GhLabel { id: number; name: string }

export function issueApi(provider: GitProvider, repo: ParsedRepo, token: string): IssueApi {
  const api = apiBase(provider, repo);
  const headers = authHeaders(provider, token);

  if (provider === "gitlab") {
    const ref = (i: GlIssue): IssueRef => ({ number: i.iid, url: i.web_url, closed: i.state === "closed", updatedAt: i.updated_at, labels: i.labels ?? [] });
    const write = (i: IssueInput) => ({ title: i.title, description: i.body });
    return {
      async create(input) {
        const created = ref(await request<GlIssue>("POST", `${api}/issues`, headers, write(input)));
        return input.closed ? this.update(created.number, input) : created;
      },
      async update(number, input) {
        return ref(await request<GlIssue>("PUT", `${api}/issues/${number}`, headers, { ...write(input), state_event: input.closed ? "close" : "reopen" }));
      },
      async recent() {
        return (await getJson<GlIssue[]>(`${api}/issues?per_page=100&order_by=updated_at&sort=desc`, headers)).map(ref);
      },
      async setStatusLabel(issue, label) {
        const remove = ALL_STATUS_LABELS.filter((n) => n !== label && hasLabel(issue.labels, n));
        const add = label && !hasLabel(issue.labels, label) ? label : null;
        if (!remove.length && !add) return;
        // GitLab legt fehlende Labels beim Zuweisen selbst an.
        await request("PUT", `${api}/issues/${issue.number}`, headers, { add_labels: add ?? "", remove_labels: remove.join(",") });
      },
    };
  }

  // GitHub und Gitea sprechen fast dieselbe Sprache.
  const ref = (i: GhIssue): IssueRef => ({ number: i.number, url: i.html_url, closed: i.state === "closed", updatedAt: i.updated_at, labels: labelNames(i.labels) });

  // Status-Labels einmal pro Lauf anlegen; Gitea braucht zudem ihre IDs.
  let labelIds: Promise<Map<string, number>> | null = null;
  const ensureLabels = () =>
    (labelIds ??= (async () => {
      const existing = await getJson<GhLabel[]>(provider === "github" ? `${api}/labels?per_page=100` : `${api}/labels?limit=50`, headers);
      const ids = new Map(existing.map((l) => [l.name.toLowerCase(), l.id]));
      for (const name of ALL_STATUS_LABELS) {
        if (ids.has(name.toLowerCase())) continue;
        const color = provider === "github" ? LABEL_COLORS[name] : `#${LABEL_COLORS[name]}`;
        const created = await request<GhLabel>("POST", `${api}/labels`, headers, { name, color, description: "Status aus VibeWorks" });
        ids.set(name.toLowerCase(), created.id);
      }
      return ids;
    })());

  const write = (i: IssueInput) => ({
    title: i.title,
    body: i.body,
    state: i.closed ? "closed" : "open",
    ...(provider === "github" && i.closed ? { state_reason: i.reason ?? "completed" } : {}),
  });
  const list = provider === "github" ? `${api}/issues?state=all&sort=updated&direction=desc&per_page=100` : `${api}/issues?state=all&type=issues&limit=50`;
  return {
    async create(input) {
      const created = ref(await request<GhIssue>("POST", `${api}/issues`, headers, { title: input.title, body: input.body }));
      return input.closed ? this.update(created.number, input) : created;
    },
    async update(number, input) {
      return ref(await request<GhIssue>("PATCH", `${api}/issues/${number}`, headers, write(input)));
    },
    async recent() {
      return (await getJson<GhIssue[]>(list, headers)).filter((i) => !i.pull_request).map(ref);
    },
    async setStatusLabel(issue, label) {
      const remove = ALL_STATUS_LABELS.filter((n) => n !== label && hasLabel(issue.labels, n));
      const add = label && !hasLabel(issue.labels, label) ? label : null;
      if (!remove.length && !add) return;
      const ids = await ensureLabels();
      const key = (name: string) => (provider === "github" ? encodeURIComponent(name) : String(ids.get(name.toLowerCase())));
      for (const name of remove) {
        await request("DELETE", `${api}/issues/${issue.number}/labels/${key(name)}`, headers).catch((err) => {
          if (!(err instanceof GitError && err.status === 404)) throw err;
        });
      }
      if (add) {
        await request("POST", `${api}/issues/${issue.number}/labels`, headers, { labels: [provider === "github" ? add : ids.get(add.toLowerCase())] });
      }
    },
  };
}
