import { parseManifest } from "./depsLogic";

// Abhängigkeiten aus allen gängigen Manifesten (#105): npm, Python, Rust, Go,
// PHP und Gradle/Maven. Nur lesen und deuten – ohne Netz, ohne Datenbank.

export const ECOSYSTEMS = ["npm", "PyPI", "crates.io", "Go", "Packagist", "Maven"] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export interface ManifestDep {
  name: string;
  range: string;
  dev: boolean;
  ecosystem: Ecosystem;
  /** Datei, aus der die Angabe stammt */
  manifest: string;
}

type Parser = (text: string) => Array<{ name: string; range: string; dev: boolean }>;

/** Bis zu dieser Tiefe werden Manifeste gesucht (Monorepos: apps/web/package.json). */
export const MAX_MANIFEST_DEPTH = 3;
export const MAX_MANIFESTS = 12;
const SKIP_DIRS = /(^|\/)(node_modules|vendor|\.git|dist|build|target|\.venv|venv|__pycache__|\.next|out|examples?|fixtures?|test-data|testdata)\//;

const FILES: Array<{ test: (base: string) => boolean; ecosystem: Ecosystem; parse: Parser }> = [
  { test: (b) => b === "package.json", ecosystem: "npm", parse: (t) => parseManifest(safeJson(t)) },
  { test: (b) => /^requirements([-_.][\w.-]+)?\.txt$/i.test(b), ecosystem: "PyPI", parse: parseRequirements },
  { test: (b) => b === "pyproject.toml", ecosystem: "PyPI", parse: parsePyproject },
  { test: (b) => b === "Cargo.toml", ecosystem: "crates.io", parse: parseCargo },
  { test: (b) => b === "go.mod", ecosystem: "Go", parse: parseGoMod },
  { test: (b) => b === "composer.json", ecosystem: "Packagist", parse: parseComposer },
  { test: (b) => b === "build.gradle" || b === "build.gradle.kts", ecosystem: "Maven", parse: parseGradle },
  { test: (b) => b === "libs.versions.toml", ecosystem: "Maven", parse: parseVersionCatalog },
  { test: (b) => b === "pom.xml", ecosystem: "Maven", parse: parsePom },
];

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Manifeste in der Dateiliste – flach zuerst, höchstens MAX_MANIFESTS. */
export function findManifests(files: string[]): Array<{ path: string; ecosystem: Ecosystem }> {
  return files
    .filter((f) => f.split("/").length <= MAX_MANIFEST_DEPTH && !SKIP_DIRS.test(f))
    .flatMap((f) => {
      const kind = FILES.find((k) => k.test(baseName(f)));
      return kind ? [{ path: f, ecosystem: kind.ecosystem }] : [];
    })
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))
    .slice(0, MAX_MANIFESTS);
}

/** Wurzel-Manifeste, die ohne lokale Kopie über die API des Git-Anbieters gelesen werden. */
export const ROOT_MANIFESTS = ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod", "composer.json", "build.gradle.kts", "build.gradle", "pom.xml"];

export const ecosystemOf = (path: string): Ecosystem | null => FILES.find((k) => k.test(baseName(path)))?.ecosystem ?? null;

export function parseManifestFile(path: string, text: string): ManifestDep[] {
  const kind = FILES.find((k) => k.test(baseName(path)));
  if (!kind) return [];
  return kind.parse(text).map((d) => ({ ...d, ecosystem: kind.ecosystem, manifest: path }));
}

/** Mehrere Manifeste zusammenführen – dieselbe Angabe nur einmal (erste gewinnt). */
export function mergeDeps(lists: ManifestDep[][], max: number): ManifestDep[] {
  const seen = new Set<string>();
  const out: ManifestDep[] = [];
  for (const d of lists.flat()) {
    const key = `${d.ecosystem}:${d.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

// ── Python ──────────────────────────────────────────────────

const PY_NAME = /^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(.*)$/;

/** „requests[socks]>=2.31 ; python_version>'3.8'“ → requests, „>=2.31“ */
function pySpec(line: string): { name: string; range: string } | null {
  const clean = line.split(";")[0].split(" #")[0].trim();
  const m = clean.match(PY_NAME);
  if (!m) return null;
  const range = m[3].replace(/\s+/g, "");
  return { name: m[1].toLowerCase().replace(/_/g, "-"), range: range || "*" };
}

export function parseRequirements(text: string): Array<{ name: string; range: string; dev: boolean }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("-") && !/^(git\+|https?:|\.|\/)/.test(l) && !l.includes("://"))
    .flatMap((l) => {
      const spec = pySpec(l);
      return spec ? [{ ...spec, dev: false }] : [];
    });
}

/** Abschnitt einer TOML-Datei als Text (bis zur nächsten Überschrift). */
function tomlSection(text: string, name: string): string | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

/** Zeichenketten eines TOML-Arrays ab `from` (auch mehrzeilig; Klammern in Zeichenketten zählen nicht). */
function readArray(text: string, from: number): string[] {
  const out: string[] = [];
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === "]") break;
    if (c === "#") {
      i = text.indexOf("\n", i);
      if (i < 0) break;
    } else if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      if (end < 0) break;
      out.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return out;
}

/** „key = [ "a", "b" ]“ */
function tomlArray(section: string, key: string): string[] {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*\\[`, "m").exec(section);
  return m ? readArray(section, m.index + m[0].length) : [];
}

/** „name = "1.2"“ und „name = { version = "1.2", … }“ */
function tomlTable(section: string): Array<{ name: string; range: string }> {
  const out: Array<{ name: string; range: string }> = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_.-]+|"[^"]+")\s*=\s*(.+)$/);
    if (!m) continue;
    const name = m[1].replace(/"/g, "");
    const value = m[2].trim();
    const plain = value.match(/^["']([^"']*)["']/);
    const inTable = value.match(/version\s*=\s*["']([^"']*)["']/);
    const range = plain?.[1] ?? inTable?.[1] ?? (value.startsWith("{") ? "*" : null);
    if (range !== null) out.push({ name, range });
  }
  return out;
}

export function parsePyproject(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const out: Array<{ name: string; range: string; dev: boolean }> = [];
  const project = tomlSection(text, "project");
  if (project) for (const s of tomlArray(project, "dependencies")) {
    const spec = pySpec(s);
    if (spec) out.push({ ...spec, dev: false });
  }
  const optional = tomlSection(text, "project.optional-dependencies");
  if (optional) for (const m of optional.matchAll(/^\s*[\w-]+\s*=\s*\[/gm)) {
    for (const s of readArray(optional, m.index + m[0].length)) {
      const spec = pySpec(s);
      if (spec) out.push({ ...spec, dev: true });
    }
  }
  const poetry = tomlSection(text, "tool.poetry.dependencies");
  if (poetry) for (const d of tomlTable(poetry)) if (d.name.toLowerCase() !== "python") out.push({ name: d.name.toLowerCase(), range: d.range, dev: false });
  for (const group of ["tool.poetry.dev-dependencies", "tool.poetry.group.dev.dependencies"]) {
    const sec = tomlSection(text, group);
    if (sec) for (const d of tomlTable(sec)) out.push({ name: d.name.toLowerCase(), range: d.range, dev: true });
  }
  return out;
}

// ── Rust ────────────────────────────────────────────────────

export function parseCargo(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const out: Array<{ name: string; range: string; dev: boolean }> = [];
  for (const [section, dev] of [["dependencies", false], ["dev-dependencies", true], ["build-dependencies", true], ["workspace.dependencies", false]] as const) {
    const sec = tomlSection(text, section);
    if (!sec) continue;
    // path-/git-Abhängigkeiten haben keine Version
    for (const line of sec.split(/\r?\n/)) {
      if (/\b(path|git)\s*=/.test(line) && !/\bversion\s*=/.test(line)) continue;
      const [d] = tomlTable(line);
      if (d && d.range !== "*") out.push({ ...d, dev });
    }
  }
  return out;
}

// ── Go ──────────────────────────────────────────────────────

export function parseGoMod(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const out: Array<{ name: string; range: string; dev: boolean }> = [];
  const add = (line: string) => {
    const m = line.trim().match(/^([\w.\-~/]+\.[\w.\-~/]+)\s+(v[\w.+-]+)(\s*\/\/\s*indirect)?/);
    // Indirekte Abhängigkeiten zählen wie Entwicklungs-Abhängigkeiten: nicht direkt gewählt
    if (m) out.push({ name: m[1], range: m[2], dev: Boolean(m[3]) });
  };
  for (const block of text.matchAll(/^require\s*\(([\s\S]*?)^\)/gm)) block[1].split(/\r?\n/).forEach(add);
  for (const single of text.matchAll(/^require\s+([^(\s].*)$/gm)) add(single[1]);
  return out;
}

// ── PHP ─────────────────────────────────────────────────────

export function parseComposer(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const obj = safeJson(text) as Record<string, unknown>;
  const take = (key: string, dev: boolean) =>
    Object.entries((obj?.[key] as Record<string, unknown>) ?? {})
      .filter(([name, v]) => typeof v === "string" && name.includes("/"))
      .map(([name, v]) => ({ name, range: (v as string).trim(), dev }));
  return [...take("require", false), ...take("require-dev", true)];
}

// ── Gradle / Maven ──────────────────────────────────────────

const GRADLE_CONF = /\b(implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt|ksp|classpath|testImplementation|testRuntimeOnly|androidTestImplementation|debugImplementation)\s*\(?\s*["']([\w.-]+):([\w.-]+):([\w.+-]+)["']/g;

export function parseGradle(text: string): Array<{ name: string; range: string; dev: boolean }> {
  return [...text.matchAll(GRADLE_CONF)].map((m) => ({ name: `${m[2]}:${m[3]}`, range: m[4], dev: /test|debug/i.test(m[1]) }));
}

export function parseVersionCatalog(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const versions = new Map(tomlTable(tomlSection(text, "versions") ?? "").map((v) => [v.name, v.range]));
  const out: Array<{ name: string; range: string; dev: boolean }> = [];
  for (const line of (tomlSection(text, "libraries") ?? "").split(/\r?\n/)) {
    const module = line.match(/module\s*=\s*["']([\w.-]+:[\w.-]+)["']/) ?? line.match(/group\s*=\s*["']([\w.-]+)["'].*name\s*=\s*["']([\w.-]+)["']/);
    const name = module ? (module[2] ? `${module[1]}:${module[2]}` : module[1]) : line.match(/=\s*["']([\w.-]+:[\w.-]+):([\w.+-]+)["']/)?.[1];
    if (!name) continue;
    const version = line.match(/version\.ref\s*=\s*["']([\w.-]+)["']/)?.[1];
    const range = version ? versions.get(version) : (line.match(/version\s*=\s*["']([\w.+-]+)["']/)?.[1] ?? line.match(/=\s*["'][\w.-]+:[\w.-]+:([\w.+-]+)["']/)?.[1]);
    if (range) out.push({ name, range, dev: false });
  }
  return out;
}

export function parsePom(text: string): Array<{ name: string; range: string; dev: boolean }> {
  const props = new Map([...text.matchAll(/<properties>([\s\S]*?)<\/properties>/g)].flatMap((p) => [...p[1].matchAll(/<([\w.-]+)>([^<]*)<\/\1>/g)].map((m) => [m[1], m[2].trim()] as const)));
  const out: Array<{ name: string; range: string; dev: boolean }> = [];
  for (const m of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const tag = (t: string) => m[1].match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1].trim();
    const group = tag("groupId");
    const artifact = tag("artifactId");
    let version = tag("version");
    const prop = version?.match(/^\$\{([\w.-]+)\}$/);
    if (prop) version = props.get(prop[1]);
    if (group && artifact && version && !version.includes("$")) out.push({ name: `${group}:${artifact}`, range: version, dev: tag("scope") === "test" });
  }
  return out;
}

/** Seite des Pakets in seiner Registry – für Links in der Oberfläche. */
export function packageUrl(ecosystem: Ecosystem | undefined, name: string): string {
  switch (ecosystem) {
    case "PyPI":
      return `https://pypi.org/project/${encodeURIComponent(name)}/`;
    case "crates.io":
      return `https://crates.io/crates/${encodeURIComponent(name)}`;
    case "Go":
      return `https://pkg.go.dev/${name}`;
    case "Packagist":
      return `https://packagist.org/packages/${name}`;
    case "Maven": {
      const [g, a] = name.split(":");
      return `https://central.sonatype.com/artifact/${encodeURIComponent(g)}/${encodeURIComponent(a ?? "")}`;
    }
    default:
      return `https://www.npmjs.com/package/${name}`;
  }
}

/** Go-Modulpfad für den Proxy: Großbuchstaben als „!klein“. */
export const goProxyPath = (module: string) => module.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`);
