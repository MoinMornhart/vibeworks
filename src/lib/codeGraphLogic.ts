import { isCodeFile, parseGrep } from "./codeIndexLogic";

// Code-Netz (#57, „Synapsen“) ohne Netz und Datenbank: Import-Zeilen lesen,
// Pfade auflösen und daraus Knoten (Dateien, Pakete) und Kanten bauen.
// Inhalte bleiben außen vor – nur Pfade und wer wen einbindet.

export const GRAPH_EXTS = ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "kt", "kts", "java", "go", "c", "h", "cc", "cpp", "hpp", "rs", "sh"] as const;
const EXT_RE = /\.(tsx?|jsx?|mjs|cjs|py|kts?|java|go|c|h|cc|cpp|hpp|rs|sh)$/;
/** Endungen für git grep – dieselben wie GRAPH_EXTS */
export const GRAPH_PATHSPECS = GRAPH_EXTS.map((e) => `*.${e}`);

type Lang = "js" | "py" | "jvm" | "go" | "c" | "rust" | "sh";
const langOf = (file: string): Lang => {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "py") return "py";
  if (ext === "kt" || ext === "kts" || ext === "java") return "jvm";
  if (ext === "go") return "go";
  if (["c", "h", "cc", "cpp", "hpp"].includes(ext)) return "c";
  if (ext === "rs") return "rust";
  if (ext === "sh") return "sh";
  return "js";
};
const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/__init__.py"];
export const MAX_FILES = 400;
export const MAX_PACKAGES = 40;
/** npm- und Python-Paketnamen – alles andere war kein echter Import (z. B. Text in JSX) */
const VALID_PKG = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

export interface GraphNode {
  id: string;
  label: string;
  kind: "file" | "package";
  /** Oberster Ordner – für Farbe und Filter */
  group: string;
  /** Zahl der Verbindungen */
  degree: number;
}
export interface CodeGraph {
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string }>;
  files: number;
  /** Knoten, die wegen der Obergrenze fehlen */
  hidden: number;
}

/** Was eine Zeile einbindet – oder null. */
export function importOf(line: string, file: string): string | null {
  const text = line.trim();
  const lang = langOf(file);
  if (lang === "jvm") {
    const m = /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?)(?:\s+as\s+\w+)?\s*;?$/.exec(text);
    return m ? m[1] : null;
  }
  if (lang === "go") {
    const m = /^(?:import\s+)?(?:[\w.]+\s+)?"([^"\s]+)"$/.exec(text);
    return m ? m[1] : null;
  }
  if (lang === "c") {
    // Nur eigene Header ("…"), System-Header (<…>) zählen nicht
    const m = /^#\s*include\s+"([^"]+)"/.exec(text);
    return m ? m[1] : null;
  }
  if (lang === "rust") {
    const mod = /^(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/.exec(text);
    if (mod) return `mod:${mod[1]}`;
    const use = /^(?:pub(?:\([^)]*\))?\s+)?use\s+([\w:]+)/.exec(text);
    return use ? use[1] : null;
  }
  if (lang === "sh") {
    const m = /^(?:source|\.)\s+["']?([\w./-]+\.sh)["']?/.exec(text);
    return m ? m[1] : null;
  }
  if (lang === "py") {
    const from = /^from\s+(\.*[\w.]*)\s+import\b/.exec(text);
    if (from) return from[1] || null;
    const imp = /^import\s+([\w.]+)/.exec(text);
    return imp ? imp[1] : null;
  }
  if (text.startsWith("//") || text.startsWith("*")) return null;
  const m = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/.exec(text);
  return m ? m[1] : null;
}

const dirOf = (file: string) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "");

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** Paketname eines externen Imports: „@scope/name“ oder „name“. */
export function packageOf(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Ziel eines Imports: eine Datei aus dem Repository, ein Paket oder null
 * (Node-Bausteine wie „node:fs“ und nicht Auflösbares zählen nicht).
 */
/** Dateien nach ihrem Pfad-Ende (z. B. „com/app/Main.kt“) – für Kotlin/Java und Go. */
const suffixIndexes = new WeakMap<Set<string>, Map<string, string>>();
function suffixIndex(files: Set<string>): Map<string, string> {
  let idx = suffixIndexes.get(files);
  if (idx) return idx;
  idx = new Map();
  for (const f of files) {
    const parts = f.split("/");
    for (let i = parts.length - 1; i >= Math.max(0, parts.length - 12); i--) {
      const key = parts.slice(i).join("/");
      if (!idx.has(key)) idx.set(key, f);
    }
  }
  suffixIndexes.set(files, idx);
  return idx;
}

const firstInDir = (files: Set<string>, dirSuffix: string, ext: RegExp) => {
  for (const f of files) if (ext.test(f) && (dirOf(f) === dirSuffix || dirOf(f).endsWith(`/${dirSuffix}`))) return f;
  return null;
};

const RUST_SKIP = new Set(["std", "core", "alloc", "self", "super", "crate"]);

function resolveOther(lang: Lang, spec: string, from: string, files: Set<string>): { file: string } | { pkg: string } | null {
  if (lang === "jvm") {
    const parts = spec.replace(/\.\*$/, "").split(".");
    const idx = suffixIndex(files);
    // com.app.ui.Screen → …/com/app/ui/Screen.kt; bei Top-Level-Funktionen eine Ebene höher
    for (let n = parts.length; n >= Math.max(2, parts.length - 1); n--) {
      const path = parts.slice(0, n).join("/");
      const hit = idx.get(`${path}.kt`) ?? idx.get(`${path}.java`) ?? idx.get(`${path}.kts`);
      if (hit) return { file: hit };
    }
    if (spec.endsWith(".*")) {
      const dir = firstInDir(files, parts.join("/"), /\.(kts?|java)$/);
      if (dir) return { file: dir };
    }
    if (["java", "javax", "kotlin"].includes(parts[0])) return null;
    const pkg = parts.slice(0, 2).join(".");
    return VALID_PKG.test(pkg) ? { pkg } : null;
  }
  if (lang === "go") {
    const parts = spec.split("/");
    if (!parts[0].includes(".")) return null; // Standardbibliothek
    // Eigenes Paket: Ordner mit passendem Pfad-Ende
    for (let n = Math.min(parts.length, 4); n >= 1; n--) {
      const hit = firstInDir(files, parts.slice(-n).join("/"), /\.go$/);
      if (hit && n >= Math.min(2, parts.length)) return { file: hit };
    }
    return { pkg: parts.slice(0, 3).join("/") };
  }
  if (lang === "c") {
    const rel = normalize(`${dirOf(from)}/${spec}`);
    if (files.has(rel)) return { file: rel };
    const hit = suffixIndex(files).get(normalize(spec));
    return hit ? { file: hit } : null;
  }
  if (lang === "rust") {
    const dir = dirOf(from);
    if (spec.startsWith("mod:")) {
      const name = spec.slice(4);
      const own = from.endsWith("/mod.rs") || from.endsWith("/lib.rs") || from.endsWith("/main.rs") ? dir : normalize(`${dir}/${from.slice(from.lastIndexOf("/") + 1, -3)}`);
      const hit = [`${own}/${name}.rs`, `${own}/${name}/mod.rs`].map(normalize).find((p) => files.has(p));
      return hit ? { file: hit } : null;
    }
    const parts = spec.split("::");
    if (parts[0] === "crate") {
      const srcRoot = from.includes("src/") ? from.slice(0, from.indexOf("src/") + 3) : "src";
      for (let n = parts.length; n >= 2; n--) {
        const path = normalize(`${srcRoot}/${parts.slice(1, n).join("/")}`);
        const hit = [`${path}.rs`, `${path}/mod.rs`].find((p) => files.has(p));
        if (hit) return { file: hit };
      }
      return null;
    }
    if (RUST_SKIP.has(parts[0])) return null;
    return VALID_PKG.test(parts[0]) ? { pkg: parts[0] } : null;
  }
  if (lang === "sh") {
    const rel = normalize(`${dirOf(from)}/${spec}`);
    return files.has(rel) ? { file: rel } : files.has(normalize(spec)) ? { file: normalize(spec) } : null;
  }
  return null;
}

export function resolveImport(spec: string, from: string, files: Set<string>, aliases: Record<string, string> = { "@/": "src/", "~/": "src/" }): { file: string } | { pkg: string } | null {
  if (spec.startsWith("node:")) return null;
  const lang = langOf(from);
  if (lang !== "js" && lang !== "py") return resolveOther(lang, spec, from, files);
  let base: string | null = null;
  if (from.endsWith(".py")) {
    if (spec.startsWith(".")) {
      const dots = spec.match(/^\.+/)![0].length;
      let dir = dirOf(from);
      for (let i = 1; i < dots; i++) dir = dirOf(dir);
      base = normalize(`${dir}/${spec.slice(dots).replace(/\./g, "/")}`);
    } else {
      const local = spec.replace(/\./g, "/");
      const hit = [local, `src/${local}`].find((p) => RESOLVE_EXTS.some((e) => files.has(p + e)));
      if (!hit) return VALID_PKG.test(spec.split(".")[0]) ? { pkg: spec.split(".")[0] } : null;
      base = hit;
    }
  } else if (spec.startsWith(".")) {
    base = normalize(`${dirOf(from)}/${spec}`);
  } else {
    const alias = Object.keys(aliases).find((a) => spec.startsWith(a));
    if (alias) base = normalize(aliases[alias] + spec.slice(alias.length));
    else return VALID_PKG.test(packageOf(spec)) ? { pkg: packageOf(spec) } : null;
  }
  if (files.has(base)) return { file: base };
  const withExt = RESOLVE_EXTS.map((e) => base + e).find((p) => files.has(p));
  // .js-Endung in TS-Quellen zeigt oft auf die .ts-Datei
  const swapped = /\.(m?js)$/.test(base) ? [".ts", ".tsx"].map((e) => base!.replace(/\.m?js$/, e)).find((p) => files.has(p)) : undefined;
  const file = withExt ?? swapped;
  return file ? { file } : null;
}

const groupOf = (file: string) => {
  const parts = file.split("/");
  if (parts.length === 1) return "(root)";
  return parts[0] === "src" && parts.length > 2 ? `src/${parts[1]}` : parts[0];
};

/**
 * Netz aus der Ausgabe von „git grep -n“ über die Import-Zeilen bauen.
 * Bei vielen Dateien bleiben die am stärksten verbundenen.
 */
export function buildCodeGraph(grepOut: string, allFiles: string[]): CodeGraph {
  const codeFiles = allFiles.filter((f) => isCodeFile(f) && EXT_RE.test(f));
  const fileSet = new Set(codeFiles);
  const edges = new Map<string, { source: string; target: string }>();
  const pkgUse = new Map<string, number>();

  for (const hit of parseGrep(grepOut, 200_000)) {
    if (!fileSet.has(hit.file)) continue;
    const spec = importOf(hit.text, hit.file);
    if (!spec) continue;
    const target = resolveImport(spec, hit.file, fileSet);
    if (!target) continue;
    const id = "file" in target ? target.file : `pkg:${target.pkg}`;
    if (id === hit.file) continue;
    if ("pkg" in target) pkgUse.set(id, (pkgUse.get(id) ?? 0) + 1);
    edges.set(`${hit.file}→${id}`, { source: hit.file, target: id });
  }

  const degree = new Map<string, number>();
  for (const e of edges.values()) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const rank = (a: string, b: string) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b);
  const keptFiles = [...fileSet].sort(rank).slice(0, MAX_FILES);
  const keptPkgs = [...pkgUse.keys()].sort(rank).slice(0, MAX_PACKAGES);
  const kept = new Set([...keptFiles, ...keptPkgs]);

  const nodes: GraphNode[] = [
    ...keptFiles.map((f) => ({ id: f, label: f.slice(f.lastIndexOf("/") + 1), kind: "file" as const, group: groupOf(f), degree: degree.get(f) ?? 0 })),
    ...keptPkgs.map((p) => ({ id: p, label: p.slice(4), kind: "package" as const, group: "packages", degree: degree.get(p) ?? 0 })),
  ];
  return {
    nodes,
    edges: [...edges.values()].filter((e) => kept.has(e.source) && kept.has(e.target)),
    files: codeFiles.length,
    hidden: fileSet.size - keptFiles.length + (pkgUse.size - keptPkgs.length),
  };
}

/** Nachbarn einer Datei – für MCP und das Detail im Netz. */
export function neighborsOf(graph: Pick<CodeGraph, "edges">, id: string) {
  return {
    imports: graph.edges.filter((e) => e.source === id).map((e) => e.target),
    importedBy: graph.edges.filter((e) => e.target === id).map((e) => e.source),
  };
}
