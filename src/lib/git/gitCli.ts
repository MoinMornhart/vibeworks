import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { tk } from "@/lib/i18n/messages";
import { assertFetchable, FetchBlockedError } from "@/lib/security/ssrf";
import { splitCommitMessage, type ParsedRepo } from "./parse";
import { GitError, type CommitInfo, type RepoSnapshot } from "./providers";

// Beliebige Git-Server ohne GitHub-/GitLab-/Gitea-API: Commits (und die
// package.json für den Abhängigkeiten-Check) direkt per git holen – flach, in
// einen Zwischenspeicher je Projekt unter DATA_DIR/git-cache. Vor jedem
// Abruf gilt derselbe SSRF-Schutz wie für die APIs; Weiterleitungen und
// andere Protokolle als http(s) sind gesperrt. Das Token reist als Header
// über Umgebungsvariablen, nie auf der Befehlszeile.

const DEPTH = 100;
const SAFE_BRANCH = /^(?!.*\.\.)[\w][\w./-]{0,200}$/;

interface ExecError extends Error {
  code?: string | number;
  killed?: boolean;
  stderr?: string;
}

/** Klon-Adresse aus der eingetragenen Repository-Adresse (ohne Oberflächen-Pfade, .git bleibt, wenn es dastand). */
export function cloneUrl(repoUrl: string, parsed: ParsedRepo): string {
  const suffix = /\.git\/?$/i.test(repoUrl.trim()) ? ".git" : "";
  return `${parsed.origin}/${parsed.path}${suffix}`;
}

/**
 * Einstellungen für git als GIT_CONFIG_COUNT/KEY/VALUE. Das Token geht als
 * Basic-Auth: „benutzer:token“ oder nur das Token (Benutzer „oauth2“).
 */
export function gitEnv(token: string | null): Record<string, string> {
  const entries: Array<[string, string]> = [
    ["protocol.allow", "never"],
    ["protocol.https.allow", "always"],
    ["protocol.http.allow", "always"],
    ["http.followRedirects", "false"],
    ["http.lowSpeedLimit", "1000"],
    ["http.lowSpeedTime", "30"],
    ["credential.helper", ""],
    ["core.askPass", ""],
  ];
  if (token) {
    const i = token.indexOf(":");
    const [user, secret] = i > 0 ? [token.slice(0, i), token.slice(i + 1)] : ["oauth2", token];
    entries.push(["http.extraHeader", `Authorization: Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`]);
  }
  const env: Record<string, string> = { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: String(entries.length) };
  entries.forEach(([key, value], n) => {
    env[`GIT_CONFIG_KEY_${n}`] = key;
    env[`GIT_CONFIG_VALUE_${n}`] = value;
  });
  return env;
}

/** git-Fehler in eine verständliche Meldung (Übersetzungsschlüssel) übersetzen. */
export function explainGitError(err: ExecError): GitError {
  if (err.code === "ENOENT") return new GitError(tk("git", "errors.gitMissing"));
  if (err.killed) return new GitError(tk("git", "errors.timeout"));
  const s = (err.stderr || err.message || "").toLowerCase();
  if (/authentication failed|could not read username|terminal prompts disabled|error: 40[13]\b/.test(s)) return new GitError(tk("git", "errors.gitAuth"), 401);
  if (/redirect|error: 30[1278]\b/.test(s)) return new GitError(tk("git", "errors.gitRedirect"));
  if (/not found|error: 404\b|does not appear to be a git repository|is this a git repository|does not exist/.test(s)) return new GitError(tk("git", "errors.gitNotFound"), 404);
  if (/could not resolve host|failed to connect|couldn't connect|connection refused|timed out/.test(s)) return new GitError(tk("git", "errors.unreachable"));
  return new GitError(tk("git", "errors.gitFailed"));
}

/** Standardzweig aus „git ls-remote --symref“ – sonst main, master oder der erste Zweig. */
export function pickBranch(lsRemote: string): string | null {
  const symref = lsRemote.match(/^ref: refs\/heads\/(\S+)\s+HEAD\s*$/m)?.[1];
  const heads = [...lsRemote.matchAll(/^[0-9a-f]{40,64}\s+refs\/heads\/(\S+)\s*$/gm)].map((m) => m[1]);
  const branch = symref ?? (heads.includes("main") ? "main" : heads.includes("master") ? "master" : heads[0]);
  return branch && SAFE_BRANCH.test(branch) ? branch : null;
}

/** Ausgabe von git log mit %x1f zwischen Feldern und %x1e zwischen Commits. */
export function parseGitLog(out: string): CommitInfo[] {
  return out
    .split("\x1e")
    .map((r) => r.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((r) => {
      const [sha, author, date, ...message] = r.split("\x1f");
      return {
        sha: sha.trim(),
        ...splitCommitMessage(message.join("\x1f").trim()),
        author: author?.trim() || "unbekannt",
        date: date?.trim() || new Date(0).toISOString(),
        url: null,
      };
    });
}

function git(args: string[], env: Record<string, string>, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { env: { ...process.env, ...env }, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(explainGitError(Object.assign(err, { stderr: String(stderr ?? "") }) as ExecError));
      else resolve(String(stdout));
    });
  });
}

function repoDir(projectId: string): string {
  if (!/^[\w-]+$/.test(projectId)) throw new GitError(tk("git", "errors.gitFailed"));
  return path.join(config.dataDir, "git-cache", `${projectId}.git`);
}

const exists = (p: string) => stat(p).then(() => true, () => false);

// Je Projekt nur ein git-Lauf gleichzeitig – sonst stolpern sie über Sperrdateien.
const locks = new Map<string, Promise<unknown>>();
function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const job = prev.then(fn, fn);
  const tail = job.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return job;
}

export function fetchViaGit(projectId: string, repoUrl: string, parsed: ParsedRepo, token: string | null): Promise<RepoSnapshot> {
  return locked(projectId, async () => {
    const url = cloneUrl(repoUrl, parsed);
    try {
      await assertFetchable(new URL(url));
    } catch (err) {
      if (err instanceof FetchBlockedError) throw new GitError(err.message);
      throw err;
    }
    const env = gitEnv(token);
    const branch = pickBranch(await git(["ls-remote", "--symref", url], env, 30_000));
    const base = { provider: "git" as const, fullName: parsed.path, webUrl: `${parsed.origin}/${parsed.path}`, defaultBranch: branch, description: null, stars: null };
    if (!branch) return { ...base, commits: [] }; // leeres Repository

    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) {
      await mkdir(dir, { recursive: true });
      await git(["init", "--bare", "--quiet", dir], env, 30_000);
    }
    await git(["-C", dir, "fetch", "--quiet", "--no-tags", "--force", `--depth=${DEPTH}`, url, `+refs/heads/${branch}:refs/heads/${branch}`], env, 120_000);
    const log = await git(["-C", dir, "log", `-n${DEPTH}`, "--format=%H%x1f%an%x1f%aI%x1f%B%x1e", `refs/heads/${branch}`, "--"], env, 30_000);
    return { ...base, commits: parseGitLog(log) };
  });
}

/** Eine Datei aus dem zuletzt geholten Stand – null, wenn es sie (oder den Zwischenspeicher) nicht gibt. */
export function readFileViaGit(projectId: string, branch: string | null, file: string): Promise<string | null> {
  if (!branch || !SAFE_BRANCH.test(branch)) return Promise.resolve(null);
  return locked(projectId, async () => {
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) return null;
    return git(["-C", dir, "show", `refs/heads/${branch}:${file}`], gitEnv(null), 15_000).catch(() => null);
  });
}

async function checkedUrl(repoUrl: string, parsed: ParsedRepo): Promise<string> {
  const url = cloneUrl(repoUrl, parsed);
  try {
    await assertFetchable(new URL(url));
  } catch (err) {
    if (err instanceof FetchBlockedError) throw new GitError(err.message);
    throw err;
  }
  return url;
}

/** Commit, auf dem ein Zweig in der lokalen Kopie steht – null ohne Kopie. */
export function localHeadViaGit(projectId: string, branch: string): Promise<string | null> {
  if (!SAFE_BRANCH.test(branch)) return Promise.resolve(null);
  return locked(projectId, async () => {
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) return null;
    return (await git(["-C", dir, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`], gitEnv(null), 10_000).catch(() => "")).trim() || null;
  });
}

/**
 * Code-Stand eines Zweigs flach holen (nur der letzte Commit) – für Code-Suche
 * und Code-Netz bei Projekten, die sonst nur über die Anbieter-API abgeglichen
 * werden. Gleicher Host, gleicher Token wie beim Abgleich.
 */
export function mirrorBranchViaGit(projectId: string, repoUrl: string, parsed: ParsedRepo, token: string | null, branch: string): Promise<void> {
  if (!SAFE_BRANCH.test(branch)) return Promise.reject(new GitError(tk("git", "errors.gitFailed")));
  return locked(projectId, async () => {
    const url = await checkedUrl(repoUrl, parsed);
    const env = gitEnv(token);
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) {
      await mkdir(dir, { recursive: true });
      await git(["init", "--bare", "--quiet", dir], env, 30_000);
    }
    await git(["-C", dir, "fetch", "--quiet", "--no-tags", "--force", "--depth=1", url, `+refs/heads/${branch}:refs/heads/${branch}`], env, 120_000);
  });
}

/** Zweige des entfernten Repositories (Namen), höchstens 100. */
export async function listRemoteBranchesViaGit(repoUrl: string, parsed: ParsedRepo, token: string | null): Promise<string[]> {
  const url = await checkedUrl(repoUrl, parsed);
  const out = await git(["ls-remote", "--heads", url], gitEnv(token), 30_000);
  return [...out.matchAll(/^[0-9a-f]{40,64}\s+refs\/heads\/(\S+)\s*$/gm)]
    .map((m) => m[1])
    .filter((b) => SAFE_BRANCH.test(b))
    .slice(0, 100);
}

/** Alle Dateipfade des zuletzt geholten Stands – ohne Inhalte, ohne Netz. */
export function listFilesViaGit(projectId: string, branch: string | null): Promise<string[]> {
  if (!branch || !SAFE_BRANCH.test(branch)) return Promise.resolve([]);
  return locked(projectId, async () => {
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) return [];
    const out = await git(["-C", dir, "ls-tree", "-r", "--name-only", `refs/heads/${branch}`], gitEnv(null), 20_000).catch(() => "");
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  });
}

/**
 * Im Code suchen – „git grep“ im schon vorhandenen Klon. Gesucht wird
 * wortwörtlich (-F), damit niemand über ein Muster die Suche lahmlegen kann.
 */
export function grepViaGit(projectId: string, branch: string | null, needle: string): Promise<string> {
  if (!branch || !SAFE_BRANCH.test(branch) || !needle.trim()) return Promise.resolve("");
  return locked(projectId, async () => {
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) return "";
    return git(
      ["-C", dir, "grep", "-n", "-I", "-i", "-F", "--max-count=5", "-e", needle.slice(0, 200), `refs/heads/${branch}`],
      gitEnv(null),
      20_000,
    ).catch(() => "");
  });
}

/** Alle Import-Zeilen (JS/TS, Python) des geholten Stands – fürs Code-Netz. */
export function grepImportsViaGit(projectId: string, branch: string | null): Promise<string> {
  if (!branch || !SAFE_BRANCH.test(branch)) return Promise.resolve("");
  return locked(projectId, async () => {
    const dir = repoDir(projectId);
    if (!(await exists(path.join(dir, "HEAD")))) return "";
    return git(
      [
        "-C", dir, "grep", "-n", "-I", "-E",
        // Grob vorfiltern – die genaue Prüfung macht importOf()
        "-e", "(from|import|require)[[:space:]]*[(]?[[:space:]]*[\"']",
        "-e", "^[[:space:]]*(from[[:space:]]+[.[:alnum:]_]+[[:space:]]+import|import[[:space:]]+[[:alnum:]_.]+)",
        `refs/heads/${branch}`, "--",
        "*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs", "*.py",
      ],
      gitEnv(null),
      30_000,
    ).catch(() => "");
  });
}

export async function dropGitCache(projectId: string): Promise<void> {
  try {
    await rm(repoDir(projectId), { recursive: true, force: true });
  } catch {
    /* egal – höchstens bleibt ein Ordner liegen */
  }
}
