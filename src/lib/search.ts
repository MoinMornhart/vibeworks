// Gemeinsame Teile der Volltextsuche – ohne Datenbank, also auch im Browser.

/** Markierungen, mit denen der Server Fundstellen einrahmt. Keine HTML-Tags:
 *  der Treffertext stammt vom Benutzer und wird als Text dargestellt. */
export const HIT_START = "⟦";
export const HIT_END = "⟧";

export interface NoteHit {
  id: string;
  title: string | null;
  snippet: string;
  projectId: string;
  projectName: string;
}

export interface TaskHit {
  id: string;
  title: string;
  snippet: string;
  status: string;
  projectId: string;
  projectName: string;
}

export interface DocHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
}

export interface SearchResult {
  notes: NoteHit[];
  tasks: TaskHit[];
  docs: DocHit[];
}

/**
 * Macht aus freier Eingabe eine sichere tsquery mit Präfixsuche:
 * „webho rech“ → „webho:* & rech:*“. Nur Buchstaben und Ziffern kommen
 * durch – Operatoren aus der Eingabe können die Abfrage nicht verbiegen.
 */
export function buildPrefixQuery(input: string): string | null {
  const words = (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 2).slice(0, 6);
  if (!words.length) return null;
  return words.map((w) => `${w}:*`).join(" & ");
}

/**
 * Teilwort für die Titelsuche (#109): die längste Eingabe ab drei Zeichen,
 * so wie getippt (Groß/klein egal). Prisma maskiert % und _ selbst.
 */
export function likePattern(input: string): string | null {
  const words = (input.match(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu) ?? []).filter((w) => w.length >= 3);
  if (!words.length) return null;
  return words.sort((a, b) => b.length - a.length)[0].slice(0, 60);
}

/** Volltext-Treffer zuerst, dann Titel-Treffer, ohne Doppelte. */
export function mergeHits<T extends { id: string }>(first: T[], more: T[], limit: number): T[] {
  const seen = new Set(first.map((x) => x.id));
  return [...first, ...more.filter((x) => !seen.has(x.id) && seen.add(x.id))].slice(0, limit);
}

/** Für den Vergleich im Browser: klein, ohne Akzente, ß → ss. */
export const foldText = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

/** Alle Wörter der Eingabe kommen in einem der Texte vor (Reihenfolge egal). */
export function matchesAll(query: string, texts: string[]): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = texts.map(foldText).join(" ");
  return words.every((w) => hay.includes(w));
}

/** Zerlegt einen Treffertext in normale und hervorgehobene Stücke. */
export function splitHighlights(text: string): Array<{ text: string; hit: boolean }> {
  return text
    .split(new RegExp(`[${HIT_START}${HIT_END}]`))
    .map((part, i) => ({ text: part, hit: i % 2 === 1 }))
    .filter((p) => p.text);
}
