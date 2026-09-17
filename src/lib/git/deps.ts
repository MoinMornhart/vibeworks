import { syncDepsTasks } from "./depsTasks";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { parseRepoUrl, type GitProvider, type ParsedRepo } from "./parse";
import { apiBase, authHeaders, GitError, requestText } from "./providers";
import { tokenCipherFor } from "./token";
import { listFilesViaGit, localHeadViaGit, readFileViaGit } from "./gitCli";
import { ensureCodeCopy } from "./codeCopy";
import { baseVersion, countPackages, MAX_PACKAGES, openRange, sortPackages, updateLevel, type DepPackage, type DepsReport } from "./depsLogic";
import { ecosystemOf, findManifests, mergeDeps, parseManifestFile, ROOT_MANIFESTS, type ManifestDep } from "./depsManifestLogic";
import { latestVersion, npmAdvisories, osvAdvisories } from "./depsRegistries";

// Abhängigkeiten-Check (#105): Manifeste aller gängigen Sprachen aus der
// lokalen Code-Kopie (sonst die Wurzel-Dateien über die API des Anbieters),
// neueste Versionen aus den Registries, Sicherheitslücken aus der npm-Quelle
// und OSV.dev. Einmal am Tag beim Git-Abgleich, sonst auf Knopfdruck – auch
// für andere Zweige.

const DAY = 86_400_000;
const PARALLEL = 8;

async function fetchRootFile(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null, file: string): Promise<string | null> {
  const api = apiBase(provider, repo);
  const ref = encodeURIComponent(branch ?? "HEAD");
  const headers = authHeaders(provider, token);
  const url =
    provider === "github"
      ? `${api}/contents/${file}?ref=${ref}`
      : provider === "gitlab"
        ? `${api}/repository/files/${encodeURIComponent(file)}/raw?ref=${ref}`
        : `${api}/raw/${file}?ref=${ref}`;
  try {
    return await requestText(url, provider === "github" ? { ...headers, Accept: "application/vnd.github.raw+json" } : headers);
  } catch (err) {
    if (err instanceof GitError && err.status === 404) return null; // gibt es hier nicht
    throw err;
  }
}

/**
 * Alle Manifeste des Zweigs – bevorzugt aus der lokalen Kopie (findet auch
 * Unterordner). Geklont wird nur auf Wunsch (Knopf, anderer Zweig); sonst
 * reicht eine schon vorhandene Kopie oder die API des Anbieters.
 */
async function collectDeps(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null, projectId?: string, allowClone = false) {
  const hasCopy = Boolean(projectId && branch && (await localHeadViaGit(projectId, branch)));
  if (projectId && (allowClone || hasCopy || provider === "git")) {
    const copy = await ensureCodeCopy(projectId, branch).catch(() => null);
    if (copy?.head) {
      const manifests = findManifests(await listFilesViaGit(projectId, copy.branch));
      const lists = await Promise.all(manifests.map(async (m) => parseManifestFile(m.path, (await readFileViaGit(projectId, copy.branch, m.path)) ?? "")));
      return { branch: copy.branch, manifests: manifests.map((m, i) => ({ ...m, count: lists[i].length })), deps: mergeDeps(lists, MAX_PACKAGES) };
    }
    if (provider === "git") return { branch, manifests: [], deps: [] as ManifestDep[] };
  }
  const found: Array<{ path: string; text: string }> = [];
  for (const file of ROOT_MANIFESTS) {
    const text = await fetchRootFile(provider, repo, token, branch, file);
    if (text !== null) found.push({ path: file, text });
  }
  const lists = found.map((f) => parseManifestFile(f.path, f.text));
  return {
    branch,
    manifests: found.map((f, i) => ({ path: f.path, ecosystem: ecosystemOf(f.path) ?? "npm", count: lists[i].length })),
    deps: mergeDeps(lists, MAX_PACKAGES),
  };
}

async function buildReport(provider: GitProvider, repo: ParsedRepo, token: string | null, branch: string | null, projectId?: string, allowClone = false): Promise<DepsReport> {
  const checkedAt = new Date().toISOString();
  let collected: Awaited<ReturnType<typeof collectDeps>>;
  try {
    collected = await collectDeps(provider, repo, token, branch, projectId, allowClone);
  } catch (err) {
    return { checkedAt, manifest: true, packages: [], counts: countPackages([]), error: err instanceof GitError ? err.message : tk("git", "errors.unreachable"), branch };
  }
  const { deps, manifests } = collected;
  if (!manifests.length) return { checkedAt, manifest: false, packages: [], counts: countPackages([]), error: null, branch: collected.branch, manifests: [] };

  const latest = new Map<ManifestDep, string | null>();
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, deps.length) }, async () => {
      while (index < deps.length) {
        const d = deps[index++];
        latest.set(d, baseVersion(d.range) ? await latestVersion(d.ecosystem, d.name) : null);
      }
    }),
  );
  const npmVersions: Record<string, string[]> = {};
  const osvItems: Array<{ ecosystem: ManifestDep["ecosystem"]; name: string; version: string }> = [];
  for (const d of deps) {
    const v = baseVersion(d.range);
    // „>=2.0“ sagt nicht, was installiert ist – dort keine Lücken melden, die längst behoben sein können
    if (!v || openRange(d.range)) continue;
    if (d.ecosystem === "npm") npmVersions[d.name] = [v];
    else osvItems.push({ ecosystem: d.ecosystem, name: d.name, version: v });
  }
  const [npmFound, osvFound] = await Promise.all([npmAdvisories(npmVersions), osvAdvisories(osvItems)]);
  const packages: DepPackage[] = deps.map((d) => {
    const current = baseVersion(d.range);
    const newest = latest.get(d) ?? null;
    return {
      name: d.name,
      range: d.range,
      dev: d.dev,
      ecosystem: d.ecosystem,
      manifest: d.manifest,
      current,
      latest: newest,
      level: updateLevel(current, newest),
      advisories: (d.ecosystem === "npm" ? npmFound[d.name] : osvFound[`${d.ecosystem}:${d.name}`]) ?? [],
    };
  });
  const sorted = sortPackages(packages);
  return { checkedAt, manifest: true, packages: sorted, counts: countPackages(sorted), error: null, branch: collected.branch, manifests };
}

const running = new Map<string, Promise<DepsReport | null>>();

/**
 * Prüfen – ohne force höchstens einmal am Tag. Der Hauptzweig wird am
 * RepoCache gespeichert (und macht Aufgaben daraus), andere Zweige nur angezeigt.
 */
export function refreshDeps(projectId: string, force = false, wantedBranch?: string | null): Promise<DepsReport | null> {
  const key = `${projectId}:${wantedBranch ?? ""}`;
  const active = running.get(key);
  if (active) return active;
  const job = (async () => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, repoCache: { select: { provider: true, defaultBranch: true, depsCheckedAt: true } } },
    });
    const cache = project?.repoCache;
    if (!project?.repoUrl || !cache?.provider) return null;
    const branch = wantedBranch || cache.defaultBranch;
    const isDefault = branch === cache.defaultBranch;
    if (!force && isDefault && cache.depsCheckedAt && Date.now() - cache.depsCheckedAt.getTime() < DAY) return null;
    const parsed = parseRepoUrl(project.repoUrl);
    if (!parsed) return null;
    const stored = await tokenCipherFor(project);
    let token: string | null = null;
    try {
      token = stored ? decrypt(stored.cipher) : null;
    } catch {
      token = null;
    }
    const report = await buildReport(cache.provider as GitProvider, parsed, token, branch, projectId, force || !isDefault);
    if (!isDefault) return report;
    await db.repoCache.update({ where: { projectId }, data: { deps: report as unknown as Prisma.InputJsonValue, depsCheckedAt: new Date() } });
    // Markiertes sofort als Aufgabe – ein Fehler dabei darf den Check nicht kippen
    await syncDepsTasks(projectId, report).catch((err) => console.error("[deps-tasks]", projectId, err));
    return report;
  })().finally(() => running.delete(key));
  running.set(key, job);
  return job;
}
