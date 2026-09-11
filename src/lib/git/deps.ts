import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { safeFetch } from "@/lib/security/ssrf";
import { tk } from "@/lib/i18n/messages";
import { parseRepoUrl, type GitProvider, type ParsedRepo } from "./parse";
import { apiBase, authHeaders, GitError, request } from "./providers";
import { tokenCipherFor } from "./token";
import { baseVersion, countPackages, parseManifest, sortPackages, updateLevel, type Advisory, type DepPackage, type DepsReport, type Severity } from "./depsLogic";

// Abhängigkeiten-Check: package.json aus dem Repository, neueste Versionen
// aus der npm-Registry, bekannte Sicherheitslücken aus derselben Quelle wie
// „npm audit“. Einmal am Tag beim Git-Abgleich, sonst auf Knopfdruck.

const DAY = 86_400_000;
const REGISTRY = "https://registry.npmjs.org";
const PARALLEL = 8;

async function fetchManifest(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null): Promise<unknown | null> {
  const api = apiBase(provider, repo);
  const ref = encodeURIComponent(branch ?? "HEAD");
  const headers = authHeaders(provider, token);
  const url =
    provider === "github"
      ? `${api}/contents/package.json?ref=${ref}`
      : provider === "gitlab"
        ? `${api}/repository/files/package.json/raw?ref=${ref}`
        : `${api}/raw/package.json?ref=${ref}`;
  try {
    return await request<unknown>("GET", url, provider === "github" ? { ...headers, Accept: "application/vnd.github.raw+json" } : headers);
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null; // keine package.json
    throw err;
  }
}

async function latestVersion(name: string): Promise<string | null> {
  try {
    const res = await safeFetch(`${REGISTRY}/${name.replace("/", "%2F")}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json", "User-Agent": "VibeWorks" },
      timeoutMs: 10_000,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { "dist-tags"?: { latest?: string } };
    return data["dist-tags"]?.latest ?? null;
  } catch {
    return null;
  }
}

async function advisories(versions: Record<string, string[]>): Promise<Record<string, Advisory[]>> {
  if (!Object.keys(versions).length) return {};
  try {
    const res = await safeFetch(`${REGISTRY}/-/npm/v1/security/advisories/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "VibeWorks" },
      body: JSON.stringify(versions),
      timeoutMs: 20_000,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, Array<{ title?: string; severity?: string; url?: string }>>;
    const out: Record<string, Advisory[]> = {};
    for (const [name, list] of Object.entries(data)) {
      out[name] = (list ?? []).map((a) => ({
        title: a.title ?? "",
        severity: (["critical", "high", "moderate", "low", "info"].includes(a.severity ?? "") ? a.severity : "info") as Severity,
        url: a.url ?? null,
      }));
    }
    return out;
  } catch {
    return {};
  }
}

export async function buildReport(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null): Promise<DepsReport> {
  const checkedAt = new Date().toISOString();
  let manifest: unknown;
  try {
    manifest = await fetchManifest(provider, repo, token, branch);
  } catch (err) {
    return { checkedAt, manifest: true, packages: [], counts: countPackages([]), error: err instanceof GitError ? err.message : tk("git", "errors.unreachable") };
  }
  if (manifest === null || manifest === undefined) return { checkedAt, manifest: false, packages: [], counts: countPackages([]), error: null };

  const deps = parseManifest(manifest);
  const latest = new Map<string, string | null>();
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, deps.length) }, async () => {
      while (index < deps.length) {
        const d = deps[index++];
        latest.set(d.name, baseVersion(d.range) ? await latestVersion(d.name) : null);
      }
    }),
  );
  const versions: Record<string, string[]> = {};
  for (const d of deps) {
    const v = baseVersion(d.range);
    if (v) versions[d.name] = [v];
  }
  const found = await advisories(versions);
  const packages: DepPackage[] = deps.map((d) => {
    const current = baseVersion(d.range);
    const newest = latest.get(d.name) ?? null;
    return { ...d, current, latest: newest, level: updateLevel(current, newest), advisories: found[d.name] ?? [] };
  });
  const sorted = sortPackages(packages);
  return { checkedAt, manifest: true, packages: sorted, counts: countPackages(sorted), error: null };
}

const running = new Map<string, Promise<DepsReport | null>>();

/** Prüfen und am RepoCache speichern – ohne force höchstens einmal am Tag. */
export function refreshDeps(projectId: string, force = false): Promise<DepsReport | null> {
  const active = running.get(projectId);
  if (active) return active;
  const job = (async () => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, repoCache: { select: { provider: true, defaultBranch: true, depsCheckedAt: true } } },
    });
    const cache = project?.repoCache;
    if (!project?.repoUrl || !cache?.provider) return null;
    if (!force && cache.depsCheckedAt && Date.now() - cache.depsCheckedAt.getTime() < DAY) return null;
    const parsed = parseRepoUrl(project.repoUrl);
    if (!parsed) return null;
    const stored = await tokenCipherFor(project);
    let token: string | null = null;
    try {
      token = stored ? decrypt(stored.cipher) : null;
    } catch {
      token = null;
    }
    const report = await buildReport(cache.provider as GitProvider, parsed, token, cache.defaultBranch);
    await db.repoCache.update({ where: { projectId }, data: { deps: report as unknown as Prisma.InputJsonValue, depsCheckedAt: new Date() } });
    return report;
  })().finally(() => running.delete(projectId));
  running.set(projectId, job);
  return job;
}
