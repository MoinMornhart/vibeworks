// Repository-Adressen zerlegen – ohne Netz, auch im Browser nutzbar.

export type GitProvider = "github" | "gitlab" | "gitea";

export interface ParsedRepo {
  origin: string;
  /** Rechnername ohne Port – für die Anbieter-Erkennung */
  host: string;
  /** host[:port] – für den Abgleich mit Git-Verbindungen */
  hostPort: string;
  /** owner/name – bei GitLab auch mit Untergruppen: gruppe/sub/projekt */
  path: string;
}

const UI_SEGMENTS = /\/(tree|blob|commits?|src|issues|pulls?|merge_requests|releases|tags|branches|wiki|actions|settings)(\/.*)?$/;

export function parseRepoUrl(input: string | null | undefined): ParsedRepo | null {
  if (!input) return null;
  let s = input.trim();
  const ssh = s.match(/^(?:ssh:\/\/)?git@([^:/\s]+)[:/](.+)$/);
  if (ssh) s = `https://${ssh[1]}/${ssh[2]}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  let path = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
  path = path.split("/-/")[0]; // GitLab-Oberfläche: /gruppe/projekt/-/tree/main
  path = path.replace(UI_SEGMENTS, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const host = url.hostname.toLowerCase();
  // GitHub kennt nur owner/name – alles danach ist Oberfläche.
  const repoPath = host === "github.com" ? parts.slice(0, 2).join("/") : parts.join("/");
  return { origin: url.origin, host, hostPort: url.host.toLowerCase(), path: repoPath };
}

export function guessProvider(host: string): GitProvider | null {
  if (host === "github.com" || host.startsWith("github.")) return "github";
  if (host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
  if (host.includes("gitea") || host.includes("forgejo") || host === "codeberg.org") return "gitea";
  return null;
}

export const PROVIDER_LABEL: Record<GitProvider, string> = { github: "GitHub", gitlab: "GitLab", gitea: "Gitea" };

/** GitHub-Seite für ein neues klassisches Token, vorausgefüllt mit dem Recht „repo“ (alle eigenen Repositories). */
export const GITHUB_NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo&description=VibeWorks";

/** Voreingestellter Server je Anbieter – Gitea/Forgejo hat keinen, das ist fast immer eine eigene Instanz. */
export const DEFAULT_SERVER: Record<GitProvider, string> = { github: "github.com", gitlab: "gitlab.com", gitea: "" };

/**
 * Serveradresse normalisieren: „git.example.de“ → https://git.example.de,
 * „http://192.168.1.5:3000/foo“ → http://192.168.1.5:3000. Pfade fallen weg.
 */
export function normalizeServer(input: string): { baseUrl: string; hostPort: string } | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const url = new URL(s);
    if (url.username || url.password || !url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return { baseUrl: url.origin, hostPort: url.host.toLowerCase() };
  } catch {
    return null;
  }
}

/** Seite, auf der man beim Anbieter ein Token erzeugt – so weit wie möglich vorausgefüllt. */
export function newTokenUrl(provider: GitProvider, baseUrl: string): string {
  if (provider === "github") return baseUrl === "https://github.com" ? GITHUB_NEW_TOKEN_URL : `${baseUrl}/settings/tokens/new?scopes=repo&description=VibeWorks`;
  if (provider === "gitlab") return `${baseUrl}/-/user_settings/personal_access_tokens?name=VibeWorks&scopes=api`;
  return `${baseUrl}/user/settings/applications`;
}

/** Erste Zeile als Titel, der Rest als Text. */
export function splitCommitMessage(message: string): { title: string; body: string } {
  const [first, ...rest] = message.replace(/\r/g, "").split("\n");
  return { title: first.trim() || "(ohne Nachricht)", body: rest.join("\n").trim() };
}

export function tokenHint(token: string): string {
  const t = token.trim();
  return t.length > 10 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "••••";
}
