// Merge-Konflikte lösen (#92) – ohne Netz und Datenbank, auch im Browser:
// Konfliktmarker zerlegen, einzelne Stellen lösen, Syntax prüfen.

export type Segment = { kind: "text"; text: string } | { kind: "conflict"; ours: string; base: string | null; theirs: string; oursLabel: string; theirsLabel: string };
export type Choice = "ours" | "theirs" | "both" | "base";

const START = "<<<<<<< ";
const BASE = "||||||| ";
const MID = "=======";
const END = ">>>>>>> ";

const isLine = (line: string, marker: string) => (marker === MID ? line === MID || line === `${MID}\r` : line.startsWith(marker));

/** Text in normale Abschnitte und Konflikte zerlegen (auch diff3 mit Basis). Unvollständige Marker bleiben Text. */
export function parseConflicts(text: string): Segment[] {
  const lines = text.split("\n");
  const out: Segment[] = [];
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) out.push({ kind: "text", text: plain.join("\n") });
    plain = [];
  };
  let i = 0;
  while (i < lines.length) {
    if (!isLine(lines[i], START)) {
      plain.push(lines[i++]);
      continue;
    }
    // Ende suchen – sonst ist es kein Konflikt
    const ours: string[] = [];
    const base: string[] = [];
    const theirs: string[] = [];
    let part: "ours" | "base" | "theirs" = "ours";
    let hasBase = false;
    let j = i + 1;
    let endLine = -1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (part === "ours" && isLine(l, BASE)) {
        part = "base";
        hasBase = true;
      } else if ((part === "ours" || part === "base") && isLine(l, MID)) part = "theirs";
      else if (part === "theirs" && isLine(l, END)) {
        endLine = j;
        break;
      } else if (isLine(l, START)) break;
      else (part === "ours" ? ours : part === "base" ? base : theirs).push(l);
    }
    if (endLine < 0) {
      plain.push(lines[i++]);
      continue;
    }
    flush();
    out.push({
      kind: "conflict",
      ours: ours.join("\n"),
      base: hasBase ? base.join("\n") : null,
      theirs: theirs.join("\n"),
      oursLabel: lines[i].slice(START.length).trim(),
      theirsLabel: lines[endLine].slice(END.length).trim(),
    });
    i = endLine + 1;
  }
  flush();
  return out;
}

export const conflictCount = (text: string) => parseConflicts(text).filter((s) => s.kind === "conflict").length;

const pick = (s: Extract<Segment, { kind: "conflict" }>, choice: Choice) =>
  choice === "ours" ? s.ours : choice === "theirs" ? s.theirs : choice === "base" ? (s.base ?? "") : [s.ours, s.theirs].filter((x) => x !== "").join("\n");

/** Segmente wieder zu Text – leere Auswahl entfernt die Zeilen ganz. */
export function joinSegments(segments: Segment[], choices: Record<number, Choice> = {}): string {
  let n = 0;
  const parts: string[] = [];
  for (const s of segments) {
    if (s.kind === "text") parts.push(s.text);
    else {
      const c = choices[n++];
      if (!c) parts.push([`${START}${s.oursLabel}`, s.ours, ...(s.base !== null ? [`${BASE}base`, s.base] : []), MID, s.theirs, `${END}${s.theirsLabel}`].filter((x, k) => x !== "" || k === 0).join("\n"));
      else {
        const chosen = pick(s, c);
        if (chosen !== "") parts.push(chosen);
      }
    }
  }
  return parts.join("\n");
}

/** Einen Konflikt (Nummer ab 0) lösen und den ganzen Text zurückgeben. */
export function resolveConflict(text: string, index: number, choice: Choice): string {
  return joinSegments(parseConflicts(text), { [index]: choice });
}

/** Alle Konflikte gleich lösen. */
export function resolveAll(text: string, choice: Choice): string {
  const segments = parseConflicts(text);
  const n = segments.filter((s) => s.kind === "conflict").length;
  return joinSegments(segments, Object.fromEntries(Array.from({ length: n }, (_, i) => [i, choice])));
}

export interface SyntaxResult {
  ok: boolean;
  /** Übersetzungsschlüssel-Anteil unter git.conflicts.syntax.* */
  problem: "markers" | "json" | "brackets" | "tags" | null;
  line: number | null;
  detail: string | null;
}

const lineOf = (text: string, offset: number) => text.slice(0, Math.max(0, offset)).split("\n").length;

/** JSON-Fehler mit Zeile (V8 nennt die Position). */
function checkJson(text: string): SyntaxResult {
  try {
    JSON.parse(text);
    return { ok: true, problem: null, line: null, detail: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const pos = /position (\d+)/.exec(msg)?.[1] ?? /line (\d+)/.exec(msg)?.[1];
    const line = /position \d+/.test(msg) ? lineOf(text, Number(pos)) : pos ? Number(pos) : null;
    return { ok: false, problem: "json", line, detail: msg.slice(0, 200) };
  }
}

/** Klammern ({[( ) ]}) ausgeglichen? Zeichenketten und Kommentare werden grob übersprungen. */
function checkBrackets(text: string): SyntaxResult {
  const stack: Array<{ c: string; line: number }> = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let line = 1;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      line++;
      if (quote === "'" || quote === '"') quote = null;
      continue;
    }
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl - 1;
    } else if (c === "(" || c === "[" || c === "{") stack.push({ c, line });
    else if (c in pairs) {
      const top = stack.pop();
      // Fehler dort melden, wo die nicht geschlossene Klammer beginnt
      if (!top || top.c !== pairs[c]) return { ok: false, problem: "brackets", line: top ? top.line : line, detail: top ? top.c : c };
    }
  }
  return stack.length ? { ok: false, problem: "brackets", line: stack[stack.length - 1].line, detail: stack[stack.length - 1].c } : { ok: true, problem: null, line: null, detail: null };
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "!doctype"]);

/** HTML: öffnende und schließende Tags passen zusammen (ohne void-Elemente, Skripte grob übersprungen). */
function checkTags(text: string): SyntaxResult {
  const stack: Array<{ tag: string; line: number }> = [];
  const re = /<(\/?)([a-zA-Z!][\w:-]*)([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tag = m[2].toLowerCase();
    if (VOID.has(tag) || m[3].trim().endsWith("/") || tag.startsWith("!")) continue;
    const line = lineOf(text, m.index);
    if (!m[1]) {
      stack.push({ tag, line });
      if (tag === "script" || tag === "style") {
        const close = text.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        if (close < 0) return { ok: false, problem: "tags", line, detail: tag };
        re.lastIndex = close;
      }
    } else {
      const top = stack.pop();
      if (!top || top.tag !== tag) return { ok: false, problem: "tags", line, detail: tag };
    }
  }
  return stack.length ? { ok: false, problem: "tags", line: stack[stack.length - 1].line, detail: stack[stack.length - 1].tag } : { ok: true, problem: null, line: null, detail: null };
}

const extOf = (path: string) => (path.split("/").pop() ?? "").split(".").pop()?.toLowerCase() ?? "";

/** Datei prüfen: zuerst offene Konfliktmarker, dann je nach Endung JSON, HTML oder Klammern. */
export function checkSyntax(path: string, text: string): SyntaxResult {
  const markers = text.split("\n").findIndex((l) => isLine(l, START) || isLine(l, END) || isLine(l, MID));
  if (markers >= 0 && conflictCount(text) > 0) return { ok: false, problem: "markers", line: markers + 1, detail: null };
  const ext = extOf(path);
  if (ext === "json") return checkJson(text);
  if (ext === "html" || ext === "htm" || ext === "vue" || ext === "svelte") return checkTags(text);
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "scss", "java", "c", "cpp", "cs", "go", "rs", "php", "kt", "swift"].includes(ext)) return checkBrackets(text);
  return { ok: true, problem: null, line: null, detail: null };
}

/** JSON hübsch formatieren – null, wenn es kein gültiges JSON ist. */
export function formatJson(text: string): string | null {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return null;
  }
}

/** Anzeigenamen der Seiten: der Pull Request ist „ours“, der Zielzweig „theirs“. */
export const sideOf = (label: string): "pr" | "base" | "other" => (label.includes("refs/vw/head") ? "pr" : label.includes("refs/vw/base") ? "base" : "other");
