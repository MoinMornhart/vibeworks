import type { ChangelogChange, ChangelogEntry } from "./changelog";

// Hinweise auf neue Funktionen: nach einem Update bekommt jedes Konto die
// Neuerungen, die eine eigene Seite oder Einstellung haben (link) – ein Klick
// in der Glocke führt direkt dorthin.

export const NEWS_MAX = 5;

export interface NewsItem {
  version: string;
  change: ChangelogChange & { link: string };
}

/** Neuerungen mit Link seit der zuletzt gestarteten Version, neueste zuerst, höchstens NEWS_MAX. Unbekannte Vorversion: nur der neueste Eintrag. */
export function newsSince(log: ChangelogEntry[], lastVersion: string | null): NewsItem[] {
  const idx = lastVersion ? log.findIndex((e) => e.version === lastVersion) : -1;
  const fresh = idx === -1 ? log.slice(0, 1) : log.slice(0, idx);
  return fresh
    .flatMap((e) => e.changes.filter((c): c is NewsItem["change"] => Boolean(c.link) && c.type !== "fix").map((change) => ({ version: e.version, change })))
    .slice(0, NEWS_MAX);
}
