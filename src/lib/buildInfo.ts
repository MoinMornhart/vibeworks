import { readFileSync } from "node:fs";
import path from "node:path";
import pkg from "../../package.json";

// Welche Version läuft gerade? Ermittelt beim Bauen (scripts/build-info.mjs)
// aus der Zahl der Commits und abgelegt in .vibeworks-build.json.

export interface BuildInfo {
  version: string;
  commit: string | null;
  shortCommit: string | null;
  /** Update-Nummer = Zahl der Commits bis zu diesem Stand */
  count: number | null;
  commitDate: string | null;
  builtAt: string | null;
  repoUrl: string | null;
  dirty: boolean;
  source: "env" | "git" | "package.json";
}

const FALLBACK: BuildInfo = {
  version: pkg.version,
  commit: null,
  shortCommit: null,
  count: null,
  commitDate: null,
  builtAt: null,
  repoUrl: null,
  dirty: false,
  source: "package.json",
};

let cached: BuildInfo | null = null;

export function buildInfo(): BuildInfo {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), ".vibeworks-build.json"), "utf8"));
    cached = { ...FALLBACK, ...raw };
  } catch {
    cached = FALLBACK;
  }
  return cached!;
}

export function commitUrl(info: BuildInfo): string | null {
  return info.repoUrl && info.commit ? `${info.repoUrl}/commit/${info.commit}` : null;
}

/** Für Client-Komponenten: nur, was angezeigt wird. */
export function publicBuildInfo() {
  const info = buildInfo();
  return {
    version: info.version,
    shortCommit: info.shortCommit,
    count: info.count,
    commitDate: info.commitDate,
    commitUrl: commitUrl(info),
    dirty: info.dirty,
  };
}
export type PublicBuildInfo = ReturnType<typeof publicBuildInfo>;
