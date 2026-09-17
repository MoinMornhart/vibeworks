import { matchesWildcard } from "@/lib/codeIndexLogic";

// Dateifilter (#92): Müll erkennen und entfernen, wichtige Dateien schützen.
// Muster wie in .gitignore – „*.exe“ gilt überall, „node_modules/“ für jeden
// Ordner dieses Namens, „src/**/*.log“ ab der Wurzel. Ohne reguläre Ausdrücke.

const FILTER_KINDS = ["trash", "protected"] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];
export interface FilterRule {
  pattern: string;
  kind: FilterKind;
}
export interface PrApproval {
  pr: number;
  sha: string;
}
export interface FileFilter {
  rules: FilterRule[];
  /** Pull Requests, die trotz Verstoß erlaubt wurden */
  allowed: PrApproval[];
  /** Zuletzt geprüfter Stand je Pull Request: „sha:state“ */
  checked: Record<string, string>;
}

const MAX_RULES = 100;
const MAX_PATTERN = 120;
export const STATUS_CONTEXT = "vibeworks/dateifilter";

/** Typischer Müll – als Vorschlag, entfernt wird nur, was man auswählt. */
export const TRASH_PRESETS = [
  "*.exe", "*.dll", "*.so", "*.dylib", "*.log", "*.tmp", "*.bak", "*.swp", "*.pyc",
  ".DS_Store", "Thumbs.db", "desktop.ini", "npm-debug.log*",
  "node_modules/", "__pycache__/", ".next/", "coverage/",
  ".env", ".env.local", ".env.production", "*.pem", "*.key", "*.p12", "*.pfx",
  "*.zip", "*.7z", "*.rar",
];
/**
 * Weiterer typischer Müll, der nur als Vorschlag auftaucht (#109): Bauwerke,
 * Medien und Datenbanken. Als Regel muss man sie bewusst aufnehmen – in
 * manchen Projekten gehören sie dazu.
 */
const TRASH_EXTRA_SUGGESTIONS = [
  "dist/", "build/", "out/", "target/", "bin/", "obj/", ".gradle/", ".venv/", "venv/", "vendor/", ".cache/", ".parcel-cache/", ".turbo/", "logs/", "tmp/",
  "*.class", "*.jar", "*.war", "*.o", "*.obj", "*.a", "*.lib", "*.iso", "*.img", "*.dmg", "*.msi",
  "*.mp4", "*.mov", "*.avi", "*.mkv", "*.wav", "*.psd", "*.ai", "*.sketch",
  "*.sqlite", "*.sqlite3", "*.db", "*.mdb", "*.dump",
  "*.orig", "*.rej", "*.old", "*.tar", "*.tgz",
];

/** Dateien, die Projekte meist brauchen – als Vorschlag für den Schutz. */
export const PROTECTED_PRESETS = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "prisma/schema.prisma", ".github/workflows/", "tsconfig.json", "Dockerfile", "README.md", "LICENSE"];

const SAFE_PATTERN = /^[\w .*?/@+-]+$/;

export function normalizeFilter(input: unknown): FileFilter {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rules: FilterRule[] = [];
  for (const raw of Array.isArray(o.rules) ? o.rules : []) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const pattern = typeof r.pattern === "string" ? r.pattern.trim().slice(0, MAX_PATTERN) : "";
    if (!pattern || !SAFE_PATTERN.test(pattern) || pattern.includes("..") || !(FILTER_KINDS as readonly unknown[]).includes(r.kind)) continue;
    if (rules.some((x) => x.pattern === pattern && x.kind === r.kind)) continue;
    rules.push({ pattern, kind: r.kind as FilterKind });
    if (rules.length >= MAX_RULES) break;
  }
  const allowed = (Array.isArray(o.allowed) ? o.allowed : [])
    .filter((a): a is PrApproval => Boolean(a) && typeof a === "object" && Number.isInteger((a as PrApproval).pr) && /^[0-9a-f]{7,64}$/.test(String((a as PrApproval).sha)))
    .slice(-100);
  const checked: Record<string, string> = {};
  if (o.checked && typeof o.checked === "object") {
    for (const [k, v] of Object.entries(o.checked as Record<string, unknown>).slice(-200)) if (/^\d+$/.test(k) && typeof v === "string") checked[k] = v.slice(0, 80);
  }
  return { rules, allowed, checked };
}

/** Ein Pfad gegen ein Muster (Groß-/Kleinschreibung egal). */
export function matchGlob(path: string, pattern: string): boolean {
  const p = pattern.trim().replace(/^\/+/, "").toLowerCase();
  const file = path.replace(/^\/+/, "").toLowerCase();
  if (!p || !file) return false;
  const dirOnly = p.endsWith("/");
  const core = dirOnly ? p.replace(/\/+$/, "") : p;
  // Ohne Schrägstrich: überall – als Dateiname bzw. als Ordner
  if (!core.includes("/")) {
    const segments = file.split("/");
    const dirs = segments.slice(0, -1);
    if (dirOnly) return dirs.some((d) => matchesWildcard(d, core));
    return matchesWildcard(segments[segments.length - 1], core) || dirs.some((d) => matchesWildcard(d, core));
  }
  const pat = (dirOnly ? `${core}/**` : core).split("/");
  return matchSegments(file.split("/"), pat);
}

function matchSegments(path: string[], pat: string[]): boolean {
  // Tabelle statt Rekursion: bleibt auch bei vielen ** schnell
  const memo = new Map<string, boolean>();
  const go = (i: number, j: number): boolean => {
    const key = `${i}:${j}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let res: boolean;
    if (j === pat.length) res = i === path.length;
    else if (pat[j] === "**") res = go(i, j + 1) || (i < path.length && go(i + 1, j));
    else res = i < path.length && matchesWildcard(path[i], pat[j].replace(/\?/g, "*")) && go(i + 1, j + 1);
    memo.set(key, res);
    return res;
  };
  return go(0, 0);
}

const matchesAny = (path: string, patterns: string[]) => patterns.some((p) => matchGlob(path, p));

export interface ScanGroup {
  pattern: string;
  /** Aus einer eigenen Regel (false: nur ein Vorschlag) */
  rule: boolean;
  count: number;
  /** Die ersten Dateien als Beispiel */
  examples: string[];
  /** Alle Dateien der Gruppe – zum Auswählen */
  files: string[];
}

export interface FilterScan {
  /** Dateien, auf die ein Müll-Muster passt */
  trash: Array<{ file: string; pattern: string }>;
  /** Vorschläge: Müll nach üblichen Mustern, die noch nicht im Filter stehen */
  suggestions: Array<{ file: string; pattern: string }>;
  /** Geschützte Dateien im Repository */
  protectedFiles: string[];
  /** Geschützte Muster ohne passende Datei – vielleicht schon gelöscht */
  missingProtected: string[];
  /** Fundstellen nach Muster zusammengefasst (#109) – zuerst die eigenen Regeln */
  groups: ScanGroup[];
}

export function scanFiles(files: string[], filter: Pick<FileFilter, "rules">, limit = 300): FilterScan {
  const trashRules = filter.rules.filter((r) => r.kind === "trash").map((r) => r.pattern);
  const protectedRules = filter.rules.filter((r) => r.kind === "protected").map((r) => r.pattern);
  const presets = [...TRASH_PRESETS, ...TRASH_EXTRA_SUGGESTIONS].filter((p) => !trashRules.includes(p));
  const trash: FilterScan["trash"] = [];
  const suggestions: FilterScan["suggestions"] = [];
  const protectedFiles: string[] = [];
  for (const file of files) {
    const rule = trashRules.find((p) => matchGlob(file, p));
    if (rule) {
      if (trash.length < limit) trash.push({ file, pattern: rule });
      continue;
    }
    const preset = presets.find((p) => matchGlob(file, p));
    if (preset && suggestions.length < limit) suggestions.push({ file, pattern: preset });
    if (protectedRules.some((p) => matchGlob(file, p)) && protectedFiles.length < limit) protectedFiles.push(file);
  }
  const missingProtected = protectedRules.filter((p) => !files.some((f) => matchGlob(f, p)));
  return { trash, suggestions, protectedFiles, missingProtected, groups: groupHits(trash, suggestions) };
}

/** Fundstellen nach Muster bündeln (#109) – „dist/ (128 Dateien)“ statt 128 Zeilen. */
function groupHits(trash: FilterScan["trash"], suggestions: FilterScan["suggestions"]): ScanGroup[] {
  const map = new Map<string, ScanGroup>();
  const add = (hits: FilterScan["trash"], rule: boolean) => {
    for (const hit of hits) {
      const key = (rule ? "r:" : "s:") + hit.pattern;
      const group = map.get(key) ?? { pattern: hit.pattern, rule, count: 0, examples: [], files: [] };
      group.count++;
      if (group.examples.length < 3) group.examples.push(hit.file);
      group.files.push(hit.file);
      map.set(key, group);
    }
  };
  add(trash, true);
  add(suggestions, false);
  return [...map.values()].sort((a, b) => Number(b.rule) - Number(a.rule) || b.count - a.count || a.pattern.localeCompare(b.pattern));
}

export interface PrFile {
  filename: string;
  status: string;
  previous_filename?: string;
}
export type ViolationKind = "protectedRemoved" | "protectedRenamed" | "extensionChanged" | "trashAdded";
export interface Violation {
  kind: ViolationKind;
  file: string;
  from?: string;
}

const extOf = (f: string) => {
  const base = f.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

/** Was ein Pull Request am Filter vorbei ändern würde. */
export function prViolations(files: PrFile[], filter: Pick<FileFilter, "rules">): Violation[] {
  const trash = filter.rules.filter((r) => r.kind === "trash").map((r) => r.pattern);
  const prot = filter.rules.filter((r) => r.kind === "protected").map((r) => r.pattern);
  const out: Violation[] = [];
  for (const f of files) {
    if (f.status === "removed" && matchesAny(f.filename, prot)) out.push({ kind: "protectedRemoved", file: f.filename });
    else if (f.status === "renamed" && f.previous_filename && matchesAny(f.previous_filename, prot)) {
      out.push({ kind: extOf(f.previous_filename) !== extOf(f.filename) ? "extensionChanged" : "protectedRenamed", file: f.filename, from: f.previous_filename });
    } else if ((f.status === "added" || f.status === "renamed" || f.status === "copied") && matchesAny(f.filename, trash)) {
      out.push({ kind: "trashAdded", file: f.filename });
    }
  }
  return out;
}

const VIOLATION_TEXT: Record<ViolationKind, string> = {
  protectedRemoved: "löscht geschützte Datei",
  protectedRenamed: "benennt geschützte Datei um",
  extensionChanged: "ändert die Endung einer geschützten Datei",
  trashAdded: "fügt gefilterte Datei hinzu",
};

/** Kurztext für den Commit-Status (GitHub erlaubt 140 Zeichen). */
export function statusDescription(violations: Violation[], allowed: boolean): string {
  if (!violations.length) return "Dateifilter: alles in Ordnung";
  if (allowed) return `Dateifilter: ${violations.length} Abweichung(en) in VibeWorks erlaubt`;
  const first = violations[0];
  return `Dateifilter: ${first.file} – ${VIOLATION_TEXT[first.kind]}${violations.length > 1 ? ` (+${violations.length - 1})` : ""}`.slice(0, 140);
}

/** Muster für .gitignore anhängen – ohne Doppelte. */
export function appendGitignore(current: string, patterns: string[]): string {
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()));
  const add = patterns.filter((p) => !have.has(p));
  if (!add.length) return current;
  const base = current && !current.endsWith("\n") ? `${current}\n` : current;
  return `${base}${base ? "\n" : ""}# Von VibeWorks (Dateifilter)\n${add.join("\n")}\n`;
}
