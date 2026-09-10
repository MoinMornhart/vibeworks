#!/usr/bin/env node
// Ermittelt beim Bauen, welche Version gerade gebaut wird, und schreibt sie
// nach .vibeworks-build.json – die App liest die Datei zur Laufzeit.
//
// Die Version ergibt sich aus der Zahl der Commits: jeder Commit ist ein
// Update und zählt eine Stufe weiter, mit Übertrag bei 9:
//   1 → 0.0.1 · 9 → 0.0.9 · 10 → 0.1.0 · 16 → 0.1.6 · 100 → 1.0.0
//
// Quellen, in dieser Reihenfolge:
//   1. Umgebung (VIBEWORKS_SHA, VIBEWORKS_COMMIT_COUNT, …) – setzt der
//      update-Befehl, denn im Release-Ordner gibt es kein .git
//   2. git im Projektordner (Entwicklung)
//   3. package.json (Notlösung)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function versionFromCount(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return `${Math.floor(n / 100)}.${Math.floor(n / 10) % 10}.${n % 10}`;
}

/** Git-Remote → Web-Adresse ohne Zugangsdaten (für Commit-Links). */
export function webUrl(remote) {
  if (!remote) return null;
  let url = String(remote).trim().replace(/\.git$/, "");
  const ssh = url.match(/^git@([^:]+):(.+)$/);
  if (ssh) url = `https://${ssh[1]}/${ssh[2]}`;
  if (!/^https?:\/\//.test(url)) return null;
  return url.replace(/^(https?:\/\/)[^@/]+@/, "$1");
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

export function collect(root, env = process.env) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const base = { packageVersion: pkg.version };

  if (env.VIBEWORKS_SHA && env.VIBEWORKS_COMMIT_COUNT) {
    const count = Number(env.VIBEWORKS_COMMIT_COUNT);
    return {
      ...base,
      version: versionFromCount(count),
      commit: env.VIBEWORKS_SHA,
      shortCommit: env.VIBEWORKS_SHA.slice(0, 7),
      count,
      commitDate: env.VIBEWORKS_COMMIT_DATE || null,
      repoUrl: webUrl(env.VIBEWORKS_REPO_URL),
      dirty: false,
      source: "env",
    };
  }

  try {
    const commit = git(["rev-parse", "HEAD"], root);
    const count = Number(git(["rev-list", "--count", "HEAD"], root));
    let dirty = false;
    let remote = null;
    try {
      dirty = git(["status", "--porcelain", "--untracked-files=no"], root).length > 0;
    } catch {
      /* egal */
    }
    try {
      remote = git(["remote", "get-url", "origin"], root);
    } catch {
      /* kein Remote */
    }
    return {
      ...base,
      version: versionFromCount(count),
      commit,
      shortCommit: commit.slice(0, 7),
      count,
      commitDate: git(["show", "-s", "--format=%cI", "HEAD"], root),
      repoUrl: webUrl(remote),
      dirty,
      source: "git",
    };
  } catch {
    return { ...base, version: pkg.version, commit: null, shortCommit: null, count: null, commitDate: null, repoUrl: null, dirty: false, source: "package.json" };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const info = { ...collect(root), builtAt: new Date().toISOString() };
  writeFileSync(join(root, ".vibeworks-build.json"), `${JSON.stringify(info, null, 2)}\n`);
  const commit = info.shortCommit ? ` (Commit ${info.shortCommit}${info.dirty ? ", mit lokalen Änderungen" : ""}, Update Nr. ${info.count})` : "";
  console.log(`Build-Info: Version ${info.version}${commit} – Quelle: ${info.source}`);
  if (info.source !== "package.json" && info.packageVersion !== info.version) {
    console.log(`Hinweis: package.json steht auf ${info.packageVersion}, die Commits ergeben ${info.version}.`);
  }
}
