import { safeFetch, FetchBlockedError } from "@/lib/security/ssrf";
import { tk } from "@/lib/i18n/messages";
import { guessProvider, splitCommitMessage, type ApiProvider, type GitProvider, type ParsedRepo } from "./parse";

// Zugriff auf GitHub, GitLab und Gitea/Forgejo über deren HTTP-APIs:
// Stammdaten und Commits lesen, Issues anlegen, ändern und abfragen.
// Beliebige Git-Server ohne API holt gitCli.ts per git.

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

/** Datei als Text (Manifeste, #105) – Fehler wie bei request(). */
export async function requestText(url: string, headers: Record<string, string>): Promise<string> {
  let res: Response;
  try {
    res = await safeFetch(url, { headers: { "User-Agent": "VibeWorks", ...headers } });
  } catch (err) {
    if (err instanceof FetchBlockedError) throw new GitError(err.message);
    if (err instanceof Error && err.name === "TimeoutError") throw new GitError(tk("git", "errors.timeout"));
    throw new GitError(tk("git", "errors.unreachable"));
  }
  if (!res.ok) throw new GitError(explain(res.status), res.status);
  return res.text();
}

export async function request<T>(method: string, url: string, headers: Record<string, string>, body?: unknown): Promise<T> {
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

export function apiBase(provider: GitProvider, repo: ParsedRepo): string {
  if (provider === "github") return `${repo.host === "github.com" ? "https://api.github.com" : `${repo.origin}/api/v3`}/repos/${repo.path}`;
  if (provider === "gitlab") return `${repo.origin}/api/v4/projects/${encodeURIComponent(repo.path)}`;
  return `${repo.origin}/api/v1/repos/${repo.path}`;
}

export function authHeaders(provider: GitProvider, token: string | null): Record<string, string> {
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

const ADAPTERS: Record<ApiProvider, (r: ParsedRepo, t: string | null) => Promise<RepoSnapshot>> = { github, gitlab, gitea };

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
  /** Zugewiesene Konten (Login bzw. Benutzername) */
  assignees: string[];
  title: string;
  body: string | null;
  /** Wer das Issue angelegt hat */
  author: string;
}

/** Labels, über die ein offenes Issue in die Spalten „In Arbeit“ bzw. „Blockiert“ fällt. */
export const STATUS_LABELS = { DOING: "in Arbeit", BLOCKED: "blockiert" } as const;
export type StatusLabel = (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS];
const LABEL_COLORS: Record<StatusLabel, string> = { "in Arbeit": "8b5cf6", blockiert: "ef4444" };
const ALL_STATUS_LABELS = Object.values(STATUS_LABELS);
const hasLabel = (labels: string[], name: string) => labels.some((l) => l.toLowerCase() === name.toLowerCase());

export interface IssueInput {
  /** Fehlt beim Aktualisieren: Titel bzw. Text bleiben, wie sie sind (übernommene Issues, #69) */
  title?: string;
  body?: string;
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
  /** Neue Kommentare aller Issues seit einem Zeitpunkt, älteste zuerst (Bot-Befehle, #79). GitLab: leer. */
  commentsSince(since: Date): Promise<IssueComment[]>;
  /** Unterhaltung eines Issues, älteste zuerst (#76). */
  comments(number: number): Promise<IssueComment[]>;
  /** Kommentar schreiben. */
  comment(number: number, body: string): Promise<void>;
  /** Recht eines Kontos im Repository: admin, maintain, write, read, none – null, wenn unbekannt. */
  permission(login: string): Promise<string | null>;
}

export interface IssueComment {
  id: number;
  issueNumber: number;
  author: string;
  body: string;
  createdAt: string;
  url: string;
}

type LabelList = Array<{ name: string } | string> | null | undefined;
const labelNames = (l: LabelList) => (l ?? []).map((x) => (typeof x === "string" ? x : x.name));

interface GhIssue { number: number; html_url: string; state: string; updated_at: string; pull_request?: unknown; labels?: LabelList; assignees?: Array<{ login: string }> | null; title?: string; body?: string | null; user?: { login: string } | null }
interface GlIssue { iid: number; web_url: string; state: string; updated_at: string; labels?: string[]; assignees?: Array<{ username: string }> | null; title?: string; description?: string | null; author?: { username: string } | null }
interface GhLabel { id: number; name: string }
interface GhComment { id: number; issue_url: string; html_url: string; body?: string | null; created_at: string; user?: { login: string } | null }
interface GlNote { id: number; body: string; created_at: string; system?: boolean; author?: { username: string } | null }

const LOGIN = /^[\w.-]{1,100}$/;

export function issueApi(provider: GitProvider, repo: ParsedRepo, token: string): IssueApi {
  const api = apiBase(provider, repo);
  const headers = authHeaders(provider, token);

  if (provider === "gitlab") {
    const ref = (i: GlIssue): IssueRef => ({
      number: i.iid,
      url: i.web_url,
      closed: i.state === "closed",
      updatedAt: i.updated_at,
      labels: i.labels ?? [],
      assignees: (i.assignees ?? []).map((a) => a.username),
      title: i.title ?? "",
      body: i.description ?? null,
      author: i.author?.username ?? "",
    });
    const write = (i: IssueInput) => ({ ...(i.title !== undefined ? { title: i.title } : {}), ...(i.body !== undefined ? { description: i.body } : {}) });
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
      // GitLab kennt keine Liste aller Kommentare eines Projekts – Bot-Befehle gibt es dort nicht
      async commentsSince() {
        return [];
      },
      async comments(number) {
        const notes = await getJson<GlNote[]>(`${api}/issues/${number}/notes?sort=asc&per_page=100`, headers);
        return notes
          .filter((n) => !n.system)
          .map((n) => ({ id: n.id, issueNumber: number, author: n.author?.username ?? "", body: n.body, createdAt: n.created_at, url: `${repo.origin}/${repo.path}/-/issues/${number}#note_${n.id}` }));
      },
      async comment(number, body) {
        await request("POST", `${api}/issues/${number}/notes`, headers, { body });
      },
      async permission() {
        return null;
      },
    };
  }

  // GitHub und Gitea sprechen fast dieselbe Sprache.
  const ref = (i: GhIssue): IssueRef => ({
    number: i.number,
    url: i.html_url,
    closed: i.state === "closed",
    updatedAt: i.updated_at,
    labels: labelNames(i.labels),
    assignees: (i.assignees ?? []).map((a) => a.login),
    title: i.title ?? "",
    body: i.body ?? null,
    author: i.user?.login ?? "",
  });

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
    ...(i.title !== undefined ? { title: i.title } : {}),
    ...(i.body !== undefined ? { body: i.body } : {}),
    state: i.closed ? "closed" : "open",
    ...(provider === "github" && i.closed ? { state_reason: i.reason ?? "completed" } : {}),
  });
  const list = provider === "github" ? `${api}/issues?state=all&sort=updated&direction=desc&per_page=100` : `${api}/issues?state=all&type=issues&limit=50`;
  const toComment = (c: GhComment): IssueComment => ({
    id: c.id,
    issueNumber: Number(c.issue_url.split("/").pop()),
    author: c.user?.login ?? "",
    body: c.body ?? "",
    createdAt: c.created_at,
    url: c.html_url,
  });
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
    async commentsSince(since) {
      const q = provider === "github" ? `sort=created&direction=asc&per_page=100` : `limit=50`;
      const rows = await getJson<GhComment[]>(`${api}/issues/comments?since=${encodeURIComponent(since.toISOString())}&${q}`, headers);
      return rows.map(toComment).filter((c) => Number.isInteger(c.issueNumber) && new Date(c.createdAt) > since);
    },
    async comments(number) {
      const q = provider === "github" ? "per_page=100" : "limit=50";
      return (await getJson<GhComment[]>(`${api}/issues/${number}/comments?${q}`, headers)).map(toComment);
    },
    async comment(number, body) {
      await request("POST", `${api}/issues/${number}/comments`, headers, { body });
    },
    async permission(login) {
      if (!LOGIN.test(login)) return null;
      try {
        const res = await getJson<{ permission?: string; role_name?: string }>(`${api}/collaborators/${encodeURIComponent(login)}/permission`, headers);
        // GitHub meldet „maintain“ nur als role_name
        return res.role_name === "maintain" ? "maintain" : (res.permission ?? null);
      } catch (err) {
        if (err instanceof GitError && err.status === 404) return "none";
        throw err;
      }
    },
  };
}
