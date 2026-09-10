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

export interface SearchResult {
  notes: NoteHit[];
  tasks: TaskHit[];
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

/** Zerlegt einen Treffertext in normale und hervorgehobene Stücke. */
export function splitHighlights(text: string): Array<{ text: string; hit: boolean }> {
  return text
    .split(new RegExp(`[${HIT_START}${HIT_END}]`))
    .map((part, i) => ({ text: part, hit: i % 2 === 1 }))
    .filter((p) => p.text);
}
