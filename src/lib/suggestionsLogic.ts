import { INTL_LOCALE, type Locale } from "./i18n/config";

// Wochen-Vorschläge ohne Datenbank: Kandidaten bewerten und bis zu fünf
// auswählen – dringend vor nützlich, höchstens zwei derselben Art, und was
// gerade angenommen oder abgelehnt wurde, kommt ein paar Wochen nicht wieder.

export const SUGGESTION_KINDS = ["vuln", "check", "ci", "git", "renewal", "overdue", "sleeping", "major", "plan", "describe"] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const PER_WEEK = 5;
export const MAX_PER_KIND = 2;
/** So viele Wochen kommt ein angenommener oder abgelehnter Vorschlag nicht wieder. */
export const QUIET_WEEKS = 3;

/** Grundgewicht je Art. */
export const WEIGHT: Record<SuggestionKind, number> = { vuln: 100, check: 95, ci: 90, git: 80, renewal: 70, overdue: 60, sleeping: 50, major: 35, plan: 30, describe: 20 };

export interface Candidate {
  key: string;
  kind: SuggestionKind;
  projectId: string | null;
  score: number;
  data: Record<string, string | number>;
}

export function pickSuggestions(candidates: Candidate[], quiet: Iterable<string>, max = PER_WEEK): Candidate[] {
  const skip = new Set(quiet);
  const perKind = new Map<SuggestionKind, number>();
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of [...candidates].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))) {
    if (out.length >= max) break;
    if (skip.has(c.key) || seen.has(c.key)) continue;
    const n = perKind.get(c.kind) ?? 0;
    if (n >= MAX_PER_KIND) continue;
    perKind.set(c.kind, n + 1);
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

/** Was „Annehmen“ tut: eine Aufgabe anlegen, Überfälliges für heute vormerken oder beim schlafenden Projekt weitermachen. */
export function acceptAction(kind: SuggestionKind): "task" | "today" | "continue" {
  return kind === "overdue" ? "today" : kind === "sleeping" ? "continue" : "task";
}

export const isSuggestionKind = (v: unknown): v is SuggestionKind => typeof v === "string" && (SUGGESTION_KINDS as readonly string[]).includes(v);

/** Werte für die Texte: Kalendertage lesbar in der Sprache, gespeicherte Fehlerschlüssel übersetzt. */
export function suggestionVars(data: Record<string, string | number>, locale: Locale, translate: (text: string) => string): Record<string, string | number> {
  const out: Record<string, string | number> = { ...data, error: typeof data.error === "string" ? translate(data.error) : "" };
  if (typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    out.date = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.date}T12:00:00Z`));
  }
  return out;
}
