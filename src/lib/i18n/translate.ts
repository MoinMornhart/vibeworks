import type { Msg, MsgTree, Vars } from "./types";

// Grundfunktionen ohne Abhängigkeiten – dürfen von Übersetzungsdateien importiert werden.

export function interpolate(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

export function format(msg: Msg, vars?: Vars): string {
  return typeof msg === "function" ? msg(vars ?? {}) : interpolate(msg, vars);
}

export function lookup(tree: MsgTree | undefined, path: string): Msg | undefined {
  let current: Msg | MsgTree | undefined = tree;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as MsgTree)[part];
  }
  return typeof current === "string" || typeof current === "function" ? current : undefined;
}

/** Einzahl/Mehrzahl über {n}: plural("{n} Projekt", "{n} Projekte"). */
export function plural(one: string, other: string): (vars: Vars) => string {
  return (vars) => interpolate(Number(vars.n) === 1 ? one : other, vars);
}

/**
 * Übersetzungsschlüssel samt Werten als eine Zeichenkette, z. B.
 * "errors.rateLimited?n=3". So reisen Meldungen durch Fehler, API-Antworten
 * und die Datenbank und werden erst beim Empfänger in dessen Sprache übersetzt.
 */
export function msgKey(key: string, vars?: Vars): string {
  if (!vars) return key;
  return `${key}?${new URLSearchParams(Object.entries(vars).map(([k, v]) => [k, String(v)]))}`;
}

const KEY_RE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+(\?.*)?$/;

export function parseMsgKey(text: string): { key: string; vars?: Vars } | null {
  if (!KEY_RE.test(text)) return null;
  const [key, query] = text.split("?", 2);
  return { key, vars: query ? Object.fromEntries(new URLSearchParams(query)) : undefined };
}
