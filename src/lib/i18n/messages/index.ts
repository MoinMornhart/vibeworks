import type { Locale } from "../config";
import type { Leaves, MsgTree, Vars } from "../types";
import { format, lookup, msgKey, parseMsgKey } from "../translate";
import common from "./common";
import status from "./status";
import errors from "./errors";
import validation from "./validation";
import auth from "./auth";
import projects from "./projects";
import share from "./share";
import tasks from "./tasks";
import notes from "./notes";
import git from "./git";
import account from "./account";
import admin from "./admin";
import theme from "./theme";
import shell from "./shell";
import docs from "./docs";
import data from "./data";
import review from "./review";
import notify from "./notify";
import mcp from "./mcp";
import live from "./live";
import grave from "./grave";
import today from "./today";
import stats from "./stats";
import prompts from "./prompts";
import costs from "./costs";
import time from "./time";
import deps from "./deps";

// Alle Übersetzungen, nach Namensräumen. Übersetzungsdateien importieren nur
// ../types und ../translate – nie App-Code, sonst entstehen Zirkelbezüge.

export const MESSAGES = { common, status, errors, validation, auth, projects, share, tasks, notes, git, account, admin, theme, shell, docs, data, review, notify, mcp, live, grave, today, stats, prompts, costs, time, deps };

export type Namespace = keyof typeof MESSAGES;
export type Key<N extends Namespace> = Leaves<(typeof MESSAGES)[N]["de"]>;
export type TFunction<N extends Namespace> = (key: Key<N>, vars?: Vars) => string;

function tree(locale: Locale, ns: Namespace): MsgTree {
  return MESSAGES[ns][locale] as unknown as MsgTree;
}

/** Übersetzer für einen Namensraum. Fehlt ein Text in der Sprache, gilt der deutsche. */
export function makeT<N extends Namespace>(locale: Locale, ns: N): TFunction<N> {
  return (key, vars) => {
    const msg = lookup(tree(locale, ns), key) ?? lookup(tree("de", ns), key);
    return msg === undefined ? `${ns}.${key}` : format(msg, vars);
  };
}

/**
 * Typgeprüfter Schlüssel für Meldungen, die erst später übersetzt werden –
 * etwa in API-Fehlern: throw new ApiError(404, tk("projects", "errors.notFound")).
 */
export function tk<N extends Namespace>(ns: N, key: Key<N>, vars?: Vars): string {
  return msgKey(`${ns}.${key}`, vars);
}

/** "ns.pfad?wert=1" in die Sprache übersetzen; gewöhnlicher Text bleibt, wie er ist. */
export function translateMessage(locale: Locale, text: string): string {
  const parsed = parseMsgKey(text);
  if (!parsed) return text;
  const [ns, ...rest] = parsed.key.split(".");
  if (!(ns in MESSAGES)) return text;
  const path = rest.join(".");
  const msg = lookup(tree(locale, ns as Namespace), path) ?? lookup(tree("de", ns as Namespace), path);
  return msg === undefined ? text : format(msg, parsed.vars);
}
