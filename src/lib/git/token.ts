import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { encrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { FetchBlockedError, safeFetch } from "@/lib/security/ssrf";
import { DEFAULT_SERVER, normalizeServer, parseRepoUrl, PROVIDER_LABEL, tokenHint, type GitProvider } from "./parse";

// Welches Token gilt für ein Projekt? Zuerst ein projekteigenes, sonst die
// Git-Verbindung des Besitzers für genau diesen Server (host:port). Ein Token
// geht so nie an einen fremden Server.

export type TokenSource = "project" | "account";

export interface ProjectTokenInput {
  ownerId: string;
  repoUrl: string | null;
  repoTokenCipher: string | null;
}

export async function accountTokenFor(ownerId: string, repoUrl: string | null): Promise<{ cipher: string; hint: string; login: string | null } | null> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return null;
  return db.gitCredential.findUnique({
    where: { userId_host: { userId: ownerId, host: parsed.hostPort } },
    select: { cipher: true, hint: true, login: true },
  });
}

export async function tokenCipherFor(project: ProjectTokenInput): Promise<{ cipher: string; source: TokenSource } | null> {
  if (project.repoTokenCipher) return { cipher: project.repoTokenCipher, source: "project" };
  const account = await accountTokenFor(project.ownerId, project.repoUrl);
  return account ? { cipher: account.cipher, source: "account" } : null;
}

// ── Verbindungen prüfen und anlegen ─────────────────────────

export class GitTokenError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Fragt beim Anbieter nach, wem das Token gehört – und prüft es damit zugleich. */
export async function whoAmI(provider: GitProvider, baseUrl: string, token: string): Promise<string | null> {
  const label = PROVIDER_LABEL[provider];
  const url =
    provider === "github"
      ? baseUrl === "https://github.com"
        ? "https://api.github.com/user"
        : `${baseUrl}/api/v3/user`
      : provider === "gitlab"
        ? `${baseUrl}/api/v4/user`
        : `${baseUrl}/api/v1/user`;
  const auth: Record<string, string> =
    provider === "github" ? { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } : provider === "gitlab" ? { "PRIVATE-TOKEN": token } : { Authorization: `token ${token}` };

  let res: Response;
  try {
    res = await safeFetch(url, { headers: { Accept: "application/json", "User-Agent": "VibeWorks", ...auth } });
  } catch (err) {
    if (err instanceof FetchBlockedError) throw new GitTokenError(err.message, 400);
    throw new GitTokenError(tk("git", "errors.hostUnreachable", { host: new URL(baseUrl).host }), 502);
  }
  // Meldungen sind Übersetzungsschlüssel; route() übersetzt sie in die Sprache der Anfrage.
  if (res.status === 401 || res.status === 403) throw new GitTokenError(tk("git", "errors.tokenUnknown", { provider: label }), 400);
  if (res.status === 404) throw new GitTokenError(tk("git", "errors.noProvider", { provider: label }), 400);
  if (!res.ok) throw new GitTokenError(tk("git", "errors.providerHttp", { provider: label, status: res.status }), 502);
  let data: { login?: string; username?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new GitTokenError(tk("git", "errors.noProvider", { provider: label }), 400);
  }
  // Ohne Namen bleibt das Feld leer – die Oberfläche zeigt dann einfach keinen an.
  return data.login ?? data.username ?? null;
}

/** Prüft das Token und liefert die Felder für db.gitCredential.create/upsert (ohne userId). */
export async function credentialData(provider: GitProvider, server: string, token: string) {
  const norm = normalizeServer(server || DEFAULT_SERVER[provider]);
  if (!norm) throw new GitTokenError(tk("git", "errors.badServer"), 400);
  const login = await whoAmI(provider, norm.baseUrl, token);
  return { provider, host: norm.hostPort, baseUrl: norm.baseUrl, cipher: encrypt(token), hint: tokenHint(token), login };
}

/**
 * Für Registrierung und Einrichtung: ohne Token nichts, sonst eine geprüfte
 * Verbindung als verschachteltes create für db.user.create. Fehler landen als
 * Feldfehler „gitToken“ im Formular – bevor ein Konto entsteht.
 */
export async function optionalCredential(input: { gitToken: string | null; gitProvider: GitProvider; gitServer: string }) {
  if (!input.gitToken) return {};
  try {
    return { gitCredentials: { create: await credentialData(input.gitProvider, input.gitServer, input.gitToken) } };
  } catch (err) {
    if (err instanceof GitTokenError) throw new ApiError(err.status, err.message, { gitToken: err.message });
    throw err;
  }
}

export async function credentialList(userId: string) {
  const rows = await db.gitCredential.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map((c) => ({ id: c.id, provider: c.provider as GitProvider, host: c.host, baseUrl: c.baseUrl, hint: c.hint, login: c.login }));
}
export type GitConnectionView = Awaited<ReturnType<typeof credentialList>>[number];
