import { foldText } from "@/lib/search";
import { eventsOf, type NotifyEvent } from "./format";

// Regeln für Benachrichtigungen (#109): wichtige Wörter, bestimmte Leute und
// Projekte. Ohne Datenbank – im Browser und auf dem Server gleich.

export const MAX_RULE_ITEMS = 30;
const MAX_LEN = 60;

export interface NotifyRules {
  /** Diese Wörter sind wichtig: solche Meldungen kommen immer durch und werden hervorgehoben */
  words: string[];
  /** Nur Meldungen von diesen Leuten (Konto- oder Git-Name) – leer: von allen */
  people: string[];
  /** Nur Meldungen aus diesen Projekten – leer: aus allen */
  projects: string[];
}

export const EMPTY_RULES: NotifyRules = { words: [], people: [], projects: [] };

const list = (raw: unknown, max = MAX_LEN): string[] =>
  Array.isArray(raw)
    ? [...new Set(raw.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, max)).filter(Boolean))].slice(0, MAX_RULE_ITEMS)
    : [];

/** Gespeicherte Regeln tolerant lesen. */
export function readRules(raw: unknown): NotifyRules {
  if (!raw || typeof raw !== "object") return EMPTY_RULES;
  const o = raw as Record<string, unknown>;
  return { words: list(o.words), people: list(o.people), projects: list(o.projects, 40) };
}

/** Eingabe „a, b\nc“ → Liste. */
export const parseRuleList = (text: string): string[] => list(text.split(/[,\n]/));

/** Kommt eines der Wörter im Text vor? Groß/klein und Akzente egal. */
export function matchesWords(words: string[], text: string): boolean {
  if (!words.length || !text) return false;
  const hay = foldText(text);
  return words.some((w) => hay.includes(foldText(w)));
}

export interface NoticeContext {
  event: NotifyEvent;
  /** Aus welchem Projekt (wenn bekannt) */
  projectId?: string | null;
  /** Wer ausgelöst hat (wenn bekannt) */
  author?: string | null;
  /** Titel und Text der Meldung – für die Wortsuche */
  text: string;
}

export interface RuleDecision {
  send: boolean;
  /** Wegen eines wichtigen Wortes – auch wenn der Anlass aus ist */
  important: boolean;
}

/**
 * Entscheidet, ob eine Meldung rausgeht: Wichtige Wörter kommen immer durch,
 * sonst gelten die Schalter und die Filter für Leute und Projekte.
 */
export function decideNotice(rules: NotifyRules, events: unknown, ctx: NoticeContext): RuleDecision {
  const important = matchesWords(rules.words, ctx.text);
  if (important) return { send: true, important: true };
  if (!eventsOf(events)[ctx.event]) return { send: false, important: false };
  if (rules.projects.length && ctx.projectId && !rules.projects.includes(ctx.projectId)) return { send: false, important: false };
  if (rules.people.length && ctx.author) {
    const who = foldText(ctx.author).replace(/^@/, "");
    if (!rules.people.some((p) => foldText(p).replace(/^@/, "") === who)) return { send: false, important: false };
  }
  return { send: true, important: false };
}
