// Code-Index ohne Netz und Datenbank: Dateilisten ordnen und die Ausgabe von
// „git grep“ zerlegen. So kann eine KI über MCP fragen, wo im verknüpften
// Repository etwas steht – ohne zu raten (#39).

/** Dateien, die niemand durchsuchen will: Abhängigkeiten, Gebautes, Binäres. */
const SKIP = [/^node_modules\//, /^\.git\//, /^dist\//, /^build\//, /^\.next\//, /^coverage\//, /(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|mp4|woff2?|ttf|eot)$/i];

export const isCodeFile = (file: string) => !SKIP.some((r) => r.test(file));

export interface GrepHit {
  file: string;
  line: number;
  text: string;
}

/**
 * Ausgabe von „git grep -n“ auf einen Zweig zerlegen. Die Zeilen sehen so aus:
 * `refs/heads/main:src/lib/foo.ts:42:  const bar = 1`
 */
export function parseGrep(out: string, limit = 60): GrepHit[] {
  const hits: GrepHit[] = [];
  for (const raw of out.split("\n")) {
    if (hits.length >= limit) break;
    const line = raw.replace(/\r$/, "");
    if (!line) continue;
    const m = /^(?:refs\/heads\/[^:]+:)?([^:]+):(\d+):(.*)$/.exec(line);
    if (!m) continue;
    const [, file, no, text] = m;
    if (!isCodeFile(file)) continue;
    hits.push({ file, line: Number(no), text: text.trim().slice(0, 300) });
  }
  return hits;
}

/** Kurzer Überblick über ein Repository: Größe, häufigste Endungen und Ordner. */
export function fileSummary(files: string[], top = 8) {
  const code = files.filter(isCodeFile);
  const count = (pick: (f: string) => string | null) => {
    const map = new Map<string, number>();
    for (const f of code) {
      const key = pick(f);
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, top)
      .map(([name, n]) => ({ name, files: n }));
  };
  return {
    files: code.length,
    skipped: files.length - code.length,
    extensions: count((f) => (/\.([A-Za-z0-9]+)$/.exec(f)?.[1] ?? null)),
    folders: count((f) => (f.includes("/") ? f.slice(0, f.indexOf("/")) : "(Wurzel)")),
  };
}

/**
 * Passt ein Pfad auf ein *-Muster? Ohne regulären Ausdruck (#61): ein aus
 * Nutzereingaben gebauter Regex mit vielen „.*“ kann sich festrechnen (ReDoS).
 * Hier: Anfang und Ende müssen passen, die Teile dazwischen der Reihe nach
 * vorkommen – das ist genau „^a.*b.*c$“, aber immer in linearer Zeit.
 */
export function matchesWildcard(text: string, pattern: string): boolean {
  const parts = pattern.split("*");
  if (parts.length === 1) return text === pattern;
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!text.startsWith(first) || !text.endsWith(last) || text.length < first.length + last.length) return false;
  let at = first.length;
  const end = text.length - last.length;
  for (const part of parts.slice(1, -1)) {
    if (!part) continue;
    const found = text.indexOf(part, at);
    if (found < 0 || found + part.length > end) return false;
    at = found + part.length;
  }
  return true;
}

/** Dateien nach einem einfachen Muster filtern: Teilstring oder *-Platzhalter. */
export function filterFiles(files: string[], pattern: string | null, limit = 200): string[] {
  const code = files.filter(isCodeFile);
  if (!pattern?.trim()) return code.slice(0, limit);
  const p = pattern.trim().toLowerCase();
  const wildcard = p.includes("*");
  return code.filter((f) => (wildcard ? matchesWildcard(f.toLowerCase(), p) : f.toLowerCase().includes(p))).slice(0, limit);
}
