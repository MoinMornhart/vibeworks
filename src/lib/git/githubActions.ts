import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { FetchBlockedError, safeFetch } from "@/lib/security/ssrf";
import { readZip } from "@/lib/zip";
import { parseRepoUrl } from "./parse";
import { tokenCipherFor } from "./token";
import { apiBase, authHeaders, GitError, request } from "./providers";

// Gemeinsame Bausteine für Workflows, die VibeWorks selbst ins Repository
// legt (Repo-Check, Lighthouse-Check): Zugang, Datei lesen/schreiben/löschen,
// jüngster Lauf, Datei aus dem Artefakt.

export interface GhRun { id: number; status: string; conclusion: string | null; html_url: string; updated_at: string }
interface GhContent { sha: string; content?: string }
interface GhArtifact { name: string; expired: boolean; size_in_bytes: number; archive_download_url: string }

export interface GhTarget {
  api: string;
  headers: Record<string, string>;
  branch: string | null;
}

/** API-Zugang eines GitHub-Projekts – nur mit Token, denn Einrichten und Artefakte brauchen ihn. */
export async function githubTarget(project: { id: string; ownerId: string; repoUrl: string | null; repoTokenCipher: string | null }): Promise<GhTarget | null> {
  if (!project.repoUrl) return null;
  const cache = await db.repoCache.findUnique({ where: { projectId: project.id }, select: { provider: true, defaultBranch: true } });
  if (cache?.provider !== "github") return null;
  const parsed = parseRepoUrl(project.repoUrl);
  if (!parsed) return null;
  const stored = await tokenCipherFor(project);
  let token: string | null = null;
  try {
    token = stored ? decrypt(stored.cipher) : null;
  } catch {
    token = null;
  }
  if (!token) return null;
  return { api: apiBase("github", parsed), headers: authHeaders("github", token), branch: cache.defaultBranch };
}

export async function readRepoFile(t: GhTarget, path: string): Promise<{ sha: string; text: string } | null> {
  try {
    const ref = t.branch ? `?ref=${encodeURIComponent(t.branch)}` : "";
    const file = await request<GhContent>("GET", `${t.api}/contents/${path}${ref}`, t.headers);
    return { sha: file.sha, text: Buffer.from(file.content ?? "", "base64").toString("utf8") };
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null;
    throw err;
  }
}

export async function writeRepoFile(t: GhTarget, path: string, text: string, message: string, sha?: string): Promise<void> {
  await request("PUT", `${t.api}/contents/${path}`, t.headers, {
    message,
    content: Buffer.from(text, "utf8").toString("base64"),
    ...(sha ? { sha } : {}),
    ...(t.branch ? { branch: t.branch } : {}),
  });
}

export async function deleteRepoFile(t: GhTarget, path: string, sha: string, message: string): Promise<void> {
  await request("DELETE", `${t.api}/contents/${path}`, t.headers, { message, sha, ...(t.branch ? { branch: t.branch } : {}) });
}

/** Fehler beim Einrichten: fehlende Rechte oder geschützter Zweig werden zu „noPermission“. */
export function installError(err: unknown): { status: "noPermission" | null; error: string } {
  if (err instanceof GitError && (err.status === 403 || err.status === 404)) return { status: "noPermission", error: tk("check", "errors.noPermission") };
  if (err instanceof GitError && (err.status === 409 || err.status === 422)) return { status: "noPermission", error: tk("check", "errors.protected") };
  return { status: null, error: err instanceof GitError ? err.message : tk("git", "errors.unreachable") };
}

export async function latestWorkflowRun(t: GhTarget, file: string): Promise<GhRun | null> {
  const branch = t.branch ? `&branch=${encodeURIComponent(t.branch)}` : "";
  try {
    const res = await request<{ workflow_runs?: GhRun[] }>("GET", `${t.api}/actions/workflows/${file}/runs?per_page=1${branch}`, t.headers);
    return res?.workflow_runs?.[0] ?? null;
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null; // gerade erst angelegt
    throw err;
  }
}

/** Workflow von Hand starten – ein gerade erst angelegter ist GitHub noch unbekannt (404), den startet der Push. */
export async function dispatchWorkflow(t: GhTarget, file: string): Promise<void> {
  try {
    await request("POST", `${t.api}/actions/workflows/${file}/dispatches`, t.headers, { ref: t.branch ?? "main" });
  } catch (err) {
    if (!(err instanceof GitError && err.status === 404)) throw err;
  }
}

/** JSON-Datei aus einem Artefakt des Laufs. Wirft GitError mit verständlicher Meldung. */
export async function artifactJson(t: GhTarget, runId: number, artifactName: string, fileName: string, maxBytes: number): Promise<unknown> {
  const list = await request<{ artifacts?: GhArtifact[] }>("GET", `${t.api}/actions/runs/${runId}/artifacts?per_page=20`, t.headers);
  const artifact = (list?.artifacts ?? []).find((a) => a.name === artifactName && !a.expired);
  if (!artifact) throw new GitError(tk("check", "errors.noArtifact"));
  if (artifact.size_in_bytes > maxBytes) throw new GitError(tk("check", "errors.tooLarge"));
  // Das Token geht nur an die API selbst; die Weiterleitung zum Speicher bekommt es nicht (safeFetch).
  if (new URL(artifact.archive_download_url).origin !== new URL(t.api).origin) throw new GitError(tk("check", "errors.badReport"));
  let res: Response;
  try {
    res = await safeFetch(artifact.archive_download_url, { headers: { "User-Agent": "VibeWorks", ...t.headers }, timeoutMs: 30_000 });
  } catch (err) {
    throw new GitError(err instanceof FetchBlockedError ? err.message : tk("git", "errors.unreachable"));
  }
  if (!res.ok) throw new GitError(tk("git", "errors.http", { status: res.status }), res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new GitError(tk("check", "errors.tooLarge"));
  try {
    const entry = readZip(buf).find((e) => e.name === fileName);
    if (!entry) throw new Error("fehlt");
    return JSON.parse(entry.data.toString("utf8"));
  } catch {
    throw new GitError(tk("check", "errors.badReport"));
  }
}
