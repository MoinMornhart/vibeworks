import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { logActivity } from "@/lib/activity";
import { nextPosition, uniqueSlug } from "@/lib/projects";
import { appLink, notifyUser } from "@/lib/notify";
import { parseRepoUrl, PROVIDER_LABEL, type GitProvider } from "./parse";
import { apiBase, authHeaders, GitError, request } from "./providers";
import { syncProjectRepository } from "./sync";
import {
  accentFor,
  countEligible,
  IMPORT_FAILS_BEFORE_NOTICE,
  IMPORT_INTERVAL_MS,
  listUrl,
  MAX_NEW_PER_RUN,
  PAGE_SIZE,
  parseRepoList,
  repoKey,
  renameCandidates,
  reposToImport,
  statusFor,
  type RemoteRepo,
} from "./importLogic";

// Automatischer Import: jedes eigene Repository einer Git-Verbindung wird zum
// Projekt – gleich nach dem Verbinden, danach alle 30 Minuten. Forks und
// archivierte bleiben draußen, verknüpfte werden wiedererkannt, gelöschte
// Projekte merkt sich die Verbindung (skipRepos) und legt sie nicht neu an.

const MAX_PAGES = 10;

async function listRepos(provider: Exclude<GitProvider, "git">, baseUrl: string, token: string): Promise<RemoteRepo[]> {
  const out: RemoteRepo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await request<unknown>("GET", listUrl(provider, baseUrl, page), authHeaders(provider, token));
    out.push(...parseRepoList(provider, data));
    if (!Array.isArray(data) || data.length < PAGE_SIZE[provider]) break;
  }
  return out;
}

export interface ImportResult {
  created: number;
  found: number;
  error: string | null;
}

const running = new Map<string, Promise<ImportResult>>();

/** Import einer Verbindung – läuft je Verbindung nur einmal gleichzeitig. Wirft nie. */
export function importFromCredential(credentialId: string): Promise<ImportResult> {
  const active = running.get(credentialId);
  if (active) return active;
  const job = runImport(credentialId)
    .catch((err): ImportResult => {
      console.error("[git-import]", credentialId, err);
      return { created: 0, found: 0, error: tk("git", "errors.syncFailed") };
    })
    .finally(() => running.delete(credentialId));
  running.set(credentialId, job);
  return job;
}

type Credential = NonNullable<Awaited<ReturnType<typeof db.gitCredential.findUnique>>>;

async function runImport(credentialId: string): Promise<ImportResult> {
  const cred = await db.gitCredential.findUnique({ where: { id: credentialId } });
  if (!cred || cred.provider === "git") return { created: 0, found: 0, error: null };
  const provider = cred.provider as Exclude<GitProvider, "git">;

  let token: string;
  try {
    token = decrypt(cred.cipher);
  } catch {
    return fail(cred, tk("git", "errors.decrypt"));
  }
  let repos: RemoteRepo[];
  try {
    repos = await listRepos(provider, cred.baseUrl, token);
  } catch (err) {
    return fail(cred, err instanceof GitError ? err.message : tk("git", "errors.syncFailed"));
  }

  // Erst Umbenennungen nachziehen – sonst sähe jedes Repository nach einem
  // neuen Benutzernamen „neu“ aus und würde doppelt angelegt
  const { skipRepos, relinked } = await followRenames(cred, provider, token, repos);

  const linked = (await db.project.findMany({ where: { ownerId: cred.userId, repoUrl: { not: null } }, select: { repoUrl: true } }))
    .map((p) => repoKey(p.repoUrl))
    .filter((k): k is string => Boolean(k));
  const fresh = reposToImport(repos, linked, skipRepos).slice(0, MAX_NEW_PER_RUN);

  const created: string[] = [];
  for (const repo of fresh) {
    const status = statusFor(repo.pushedAt);
    const name = repo.name.slice(0, 120);
    const project = await db.project.create({
      data: {
        ownerId: cred.userId,
        name,
        slug: await uniqueSlug(cred.userId, name),
        summary: repo.description?.trim().slice(0, 240) || null,
        status,
        accent: accentFor(name),
        progressFromTasks: true,
        repoUrl: repo.url,
        position: await nextPosition(cred.userId, status),
      },
      select: { id: true, name: true },
    });
    await logActivity({ projectId: project.id, userId: cred.userId, kind: "PROJECT_CREATED", summary: `Projekt „${project.name}“ aus ${PROVIDER_LABEL[provider]} importiert`, meta: { name: project.name } });
    created.push(project.id);
  }

  const found = countEligible(repos);
  await db.gitCredential.update({ where: { id: cred.id }, data: { importedAt: new Date(), importError: null, importFails: 0, importCount: found } });

  // Commits der neuen und umgehängten Projekte gleich holen – nacheinander, im Hintergrund
  created.push(...relinked);
  if (created.length) {
    void (async () => {
      const projects = await db.project.findMany({
        where: { id: { in: created } },
        select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true }
      });
      for (const p of projects) {
        await syncProjectRepository(p).catch(() => undefined);
      }
    })();
  }
  return { created: created.length - relinked.length, found, error: null };
}

/** Bestätigt der Anbieter, dass die alte Adresse auf dieses Repository weiterleitet? */
async function sameRepository(provider: Exclude<GitProvider, "git">, cred: Credential, oldKey: string, repoUrl: string, token: string): Promise<boolean> {
  const old = parseRepoUrl(`${cred.baseUrl}/${oldKey.slice(oldKey.indexOf("/") + 1)}`);
  if (!old) return false;
  try {
    const data = await request<Record<string, unknown>>("GET", apiBase(provider, old), authHeaders(provider, token));
    const url = provider === "gitlab" ? data.web_url : data.html_url;
    return typeof url === "string" && repoKey(url) === repoKey(repoUrl);
  } catch {
    return false; // alte Adresse gibt es nicht mehr – dann lieber nichts umhängen
  }
}

/** Steckt in einem Projekt nichts Eigenes? Aufgaben aus Issues zählen nicht – die hat das Original auch. */
async function untouched(projectId: string): Promise<boolean> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: {
      _count: {
        select: { notes: true, prompts: true, costs: true, timeEntries: true, codeMemos: true, members: true, teams: true, aiWorkflows: true, suggestions: true, uptimeChecks: true, tasks: { where: { issueNumber: null } } },
      },
    },
  });
  return Boolean(p) && Object.values(p!._count).every((n) => n === 0);
}

/**
 * Umbenannte oder umgezogene Repositories nachziehen: verknüpfte Projekte auf die
 * neue Adresse umhängen, „absichtlich entfernt“ mitnehmen und Kopien, die der
 * Import vorher schon angelegt hat, wieder entfernen – aber nur unberührte.
 */
async function followRenames(cred: Credential, provider: Exclude<GitProvider, "git">, token: string, repos: RemoteRepo[]): Promise<{ skipRepos: string[]; relinked: string[] }> {
  const owned = (await db.project.findMany({ where: { ownerId: cred.userId, repoUrl: { not: null } }, select: { id: true, name: true, repoUrl: true, createdAt: true } }))
    .map((p) => ({ ...p, key: repoKey(p.repoUrl) }))
    .filter((p): p is typeof p & { key: string } => Boolean(p.key));
  let skipRepos = [...cred.skipRepos];
  const relinked: string[] = [];

  for (const { oldKey, repo } of renameCandidates(repos, [...owned.map((p) => p.key), ...skipRepos])) {
    if (!(await sameRepository(provider, cred, oldKey, repo.url, token))) continue;
    const newKey = repoKey(repo.url)!;
    skipRepos = skipRepos.map((k) => (k.toLowerCase() === oldKey ? newKey : k));

    const originals = owned.filter((p) => p.key === oldKey);
    if (!originals.length) continue;
    const firstOriginal = Math.min(...originals.map((p) => p.createdAt.getTime()));
    const copies = owned.filter((p) => p.key === newKey && p.createdAt.getTime() > firstOriginal);
    const kept = (await Promise.all(copies.map(async (c) => ((await untouched(c.id)) ? null : c)))).filter(Boolean);
    // In einer Kopie wurde schon gearbeitet – dann nichts zusammenwerfen, das entscheidet der Mensch
    if (kept.length) continue;
    if (copies.length) await db.project.deleteMany({ where: { id: { in: copies.map((c) => c.id) } } });

    await db.project.updateMany({ where: { id: { in: originals.map((p) => p.id) } }, data: { repoUrl: repo.url } });
    await Promise.all(
      originals.map((p) =>
        logActivity({ projectId: p.id, userId: cred.userId, kind: "PROJECT_UPDATED", summary: `Repository umgezogen: ${oldKey} → ${newKey}`, meta: { from: oldKey, to: newKey, removedCopies: copies.length } }),
      ),
    );
    relinked.push(...originals.map((p) => p.id));
  }

  if (skipRepos.some((k, i) => k !== cred.skipRepos[i])) {
    await db.gitCredential.update({ where: { id: cred.id }, data: { skipRepos } });
  }
  return { skipRepos, relinked };
}

async function fail(cred: Credential, message: string): Promise<ImportResult> {
  const updated = await db.gitCredential.update({ where: { id: cred.id }, data: { importedAt: new Date(), importError: message, importFails: { increment: 1 } } });
  // Einmal melden, wenn es nicht nur ein Aussetzer war
  if (updated.importFails === IMPORT_FAILS_BEFORE_NOTICE) {
    void notifyUser(cred.userId, "gitFailed", (t, locale) => ({
      event: "gitFailed",
      title: t("events.importFailed.title", { host: cred.host }),
      message: t("events.importFailed.message", { error: translateMessage(locale, message) }),
      url: appLink("/account#git-zugang"),
      priority: "high",
    }));
  }
  return { created: 0, found: cred.importCount, error: message };
}

/** Fällige Importe (alle 30 Minuten je Verbindung) – aus dem Git-Takt. */
export async function runImports(now = Date.now()): Promise<void> {
  const due = await db.gitCredential.findMany({
    where: { autoImport: true, provider: { not: "git" }, OR: [{ importedAt: null }, { importedAt: { lt: new Date(now - IMPORT_INTERVAL_MS) } }] },
    select: { id: true },
  });
  for (const c of due) await importFromCredential(c.id);
}

/** Gelöschtes oder umgehängtes Repository merken – der Import legt es nicht wieder an. */
export async function rememberRemovedRepo(ownerId: string, repoUrl: string | null): Promise<void> {
  const key = repoKey(repoUrl);
  if (!key) return;
  const host = key.slice(0, key.indexOf("/"));
  const cred = await db.gitCredential.findUnique({ where: { userId_host: { userId: ownerId, host } }, select: { id: true, skipRepos: true } });
  if (!cred || cred.skipRepos.includes(key)) return;
  await db.gitCredential.update({ where: { id: cred.id }, data: { skipRepos: { push: key } } });
}
