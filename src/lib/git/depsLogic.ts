import type { Ecosystem } from "./depsManifestLogic";

// Abhängigkeiten-Check ohne Netz: package.json lesen, Versionsbereiche
// deuten, Abstand zur neuesten Version einstufen.

export type UpdateLevel = "major" | "minor" | "patch" | "current" | "unknown";
export type Severity = "critical" | "high" | "moderate" | "low" | "info";

export interface Advisory {
  title: string;
  severity: Severity;
  url: string | null;
}

export interface DepPackage {
  name: string;
  range: string;
  dev: boolean;
  current: string | null;
  latest: string | null;
  level: UpdateLevel;
  advisories: Advisory[];
  /** Fehlt bei älteren Berichten – dann npm (#105) */
  ecosystem?: Ecosystem;
  /** Datei, aus der die Angabe stammt */
  manifest?: string;
}

export interface DepsReport {
  checkedAt: string;
  /** false: im Repository liegt keine package.json */
  manifest: boolean;
  packages: DepPackage[];
  counts: { total: number; outdated: number; major: number; vulnerable: number };
  /** Meldung oder Übersetzungsschlüssel, wenn die Prüfung scheiterte */
  error: string | null;
  /** Geprüfter Zweig und gefundene Manifeste (#105) */
  branch?: string | null;
  manifests?: Array<{ path: string; ecosystem: Ecosystem; count: number }>;
}

export const MAX_PACKAGES = 200;

export function parseManifest(json: unknown): Array<{ name: string; range: string; dev: boolean }> {
  const obj = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const take = (key: string, dev: boolean) => {
    const block = obj[key];
    if (!block || typeof block !== "object") return [];
    return Object.entries(block as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string")
      .map(([name, range]) => ({ name, range: (range as string).trim(), dev }));
  };
  const seen = new Set<string>();
  return [...take("dependencies", false), ...take("devDependencies", true)].filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true))).slice(0, MAX_PACKAGES);
}

/** „^15.1.0“ → „15.1.0“, „~1.2“ → „1.2.0“; Git-, Datei-, Workspace- und Alias-Angaben → null. */
export function baseVersion(range: string): string | null {
  if (/^(workspace:|file:|link:|git|https?:|npm:|github:)/i.test(range) || range.includes("/")) return null;
  const m = range.match(/(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/);
  if (!m) return null;
  const part = (v: string | undefined) => (v && /^\d+$/.test(v) ? v : "0");
  return `${m[1]}.${part(m[2])}.${part(m[3])}`;
}

function parts(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Nach oben offene Angabe (>=, >) – die Untergrenze ist nicht die installierte Version. */
export const openRange = (range: string) => /^\s*>/.test(range);

const isStable = (v: string) => /^\d+\.\d+\.\d+$/.test(v);

/**
 * Die Version, auf die sich ein Update lohnt: das Tag „latest“ – außer es
 * zeigt auf eine Vorabversion (8.0.0-rc.15), dann die höchste stabile.
 */
export function stableLatest(tag: string | null, versions: string[]): string | null {
  if (tag && isStable(tag)) return tag;
  let best: string | null = null;
  for (const v of versions) {
    if (!isStable(v)) continue;
    const a = parts(v)!;
    const b = best ? parts(best)! : null;
    if (!b || a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = v;
  }
  return best ?? tag;
}

export function updateLevel(current: string | null, latest: string | null): UpdateLevel {
  const a = current ? parts(current) : null;
  const b = latest ? parts(latest) : null;
  if (!a || !b) return "unknown";
  if (b[0] > a[0]) return "major";
  if (b[0] < a[0]) return "current";
  if (b[1] > a[1]) return "minor";
  if (b[1] < a[1]) return "current";
  return b[2] > a[2] ? "patch" : "current";
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
export const severityRank = (s: Severity) => SEVERITY_RANK[s] ?? 0;
const LEVEL_RANK: Record<UpdateLevel, number> = { major: 3, minor: 2, patch: 1, current: 0, unknown: 0 };

/** Sortierung: Sicherheitswarnungen zuerst, dann Major, Minor, Patch, Rest nach Name. */
export function sortPackages(list: DepPackage[]): DepPackage[] {
  const worst = (p: DepPackage) => Math.max(-1, ...p.advisories.map((a) => severityRank(a.severity)));
  return [...list].sort((a, b) => worst(b) - worst(a) || LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.name.localeCompare(b.name));
}

export type PackageRisk = "vulnerable" | "major";

/** Pakete mit Handlungsbedarf – fürs Einfärben im Code-Netz (#105). Sicherheitslücke schlägt Update. */
export function packageRisks(deps: Pick<DepsReport, "packages"> | null): Record<string, PackageRisk> {
  const out: Record<string, PackageRisk> = {};
  for (const p of deps?.packages ?? []) {
    if (p.advisories.length) out[p.name] = "vulnerable";
    else if (p.level === "major" && !out[p.name]) out[p.name] = "major";
  }
  return out;
}

export function countPackages(list: DepPackage[]): DepsReport["counts"] {
  return {
    total: list.length,
    outdated: list.filter((p) => p.level === "major" || p.level === "minor" || p.level === "patch").length,
    major: list.filter((p) => p.level === "major").length,
    vulnerable: list.filter((p) => p.advisories.length > 0).length,
  };
}
