import { parseRepoUrl, type ApiProvider } from "./parse";

// Automatischer Import – ohne Netz und Datenbank, damit testbar: welche
// Repositories einer Git-Verbindung neu als Projekt dazukommen.

export interface RemoteRepo {
  url: string;
  name: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  pushedAt: string | null;
}

export const IMPORT_INTERVAL_MS = 30 * 60_000;
export const MAX_NEW_PER_RUN = 50;
/** Ab so vielen Import-Fehlschlägen in Folge kommt eine Benachrichtigung (einmal). */
export const IMPORT_FAILS_BEFORE_NOTICE = 2;
export const PAGE_SIZE: Record<ApiProvider, number> = { github: 100, gitlab: 100, gitea: 50 };
const ACTIVE_DAYS = 90;
const ACCENTS = ["violet", "cyan", "emerald", "amber", "rose", "blue"];

/** „host[:port]/pfad“ in Kleinbuchstaben – so erkennt der Import verknüpfte Repositories wieder. */
export function repoKey(url: string | null | undefined): string | null {
  const p = parseRepoUrl(url);
  return p ? `${p.hostPort}/${p.path.toLowerCase()}` : null;
}

/** Neu: eigene Repositories ohne Forks und archivierte, noch nicht verknüpft und nicht absichtlich entfernt. */
export function reposToImport(repos: RemoteRepo[], linked: Iterable<string>, skip: Iterable<string>): RemoteRepo[] {
  const seen = new Set([...linked].map((k) => k.toLowerCase()));
  const skipped = new Set([...skip].map((k) => k.toLowerCase()));
  const out: RemoteRepo[] = [];
  for (const repo of repos) {
    if (repo.fork || repo.archived) continue;
    const key = repoKey(repo.url);
    if (!key || seen.has(key) || skipped.has(key)) continue;
    seen.add(key);
    out.push(repo);
  }
  return out;
}

export const countEligible = (repos: RemoteRepo[]) => repos.filter((r) => !r.fork && !r.archived).length;

/** Kürzlich bearbeitet → „In Entwicklung“, sonst „Offen“. */
export function statusFor(pushedAt: string | null, now = Date.now()): "IN_PROGRESS" | "OPEN" {
  const at = pushedAt ? Date.parse(pushedAt) : Number.NaN;
  return Number.isFinite(at) && now - at < ACTIVE_DAYS * 86_400_000 ? "IN_PROGRESS" : "OPEN";
}

/** Fester Akzent je Name – dasselbe Repository bekommt immer dieselbe Farbe. */
export function accentFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function listUrl(provider: ApiProvider, baseUrl: string, page: number): string {
  if (provider === "github") {
    const api = baseUrl === "https://github.com" ? "https://api.github.com" : `${baseUrl}/api/v3`;
    return `${api}/user/repos?affiliation=owner&sort=pushed&per_page=${PAGE_SIZE.github}&page=${page}`;
  }
  if (provider === "gitlab") return `${baseUrl}/api/v4/projects?owned=true&archived=false&order_by=last_activity_at&per_page=${PAGE_SIZE.gitlab}&page=${page}`;
  return `${baseUrl}/api/v1/user/repos?limit=${PAGE_SIZE.gitea}&page=${page}`;
}

type Row = Record<string, unknown>;
const rows = (data: unknown): Row[] => (Array.isArray(data) ? data.filter((x): x is Row => Boolean(x) && typeof x === "object") : []);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Antwort des Anbieters in eine einheitliche Liste. */
export function parseRepoList(provider: ApiProvider, data: unknown): RemoteRepo[] {
  return rows(data)
    .map((r): RemoteRepo | null => {
      const url = str(provider === "gitlab" ? r.web_url : r.html_url);
      const name = str(r.name);
      if (!url || !name) return null;
      return {
        url,
        name,
        description: str(r.description),
        fork: provider === "gitlab" ? Boolean(r.forked_from_project) : r.fork === true,
        archived: r.archived === true,
        pushedAt: str(provider === "github" ? r.pushed_at : provider === "gitlab" ? r.last_activity_at : r.updated_at),
      };
    })
    .filter((r): r is RemoteRepo => r !== null);
}
