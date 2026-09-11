import { dayKey } from "./utils";
import { zonedMidnight } from "./weeks";

// Demo-Instanz (DEMO_MODE=true): alles lesbar, schreiben nur, was zum
// Ansehen nötig ist – Demo-Anmeldung, Anmelden, Abmelden, Sprache. Ohne
// Datenbank, damit testbar.

export const DEMO_USERNAME = "demo";
const RESET_HOUR = 3;
const HOUR = 3_600_000;

/** Letzter fälliger Reset: heute 3 Uhr (Europe/Berlin), vor 3 Uhr der von gestern. */
export function lastResetMark(now: Date): Date {
  const at = (d: Date) => new Date(zonedMidnight(dayKey(d)).getTime() + RESET_HOUR * HOUR);
  const today = at(now);
  return now >= today ? today : at(new Date(now.getTime() - 24 * HOUR));
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED = new Set(["/api/auth/demo", "/api/auth/login", "/api/auth/logout", "/api/locale"]);

export function demoAllows(method: string, pathname: string): boolean {
  if (SAFE.has(method.toUpperCase())) return true;
  return ALLOWED.has(pathname.replace(/\/+$/, ""));
}

/**
 * Zurücksetzen nur, wenn die Instanz ausschließlich das Demo-Konto kennt (oder
 * noch leer ist) – eine echte Instanz mit versehentlich gesetztem DEMO_MODE
 * bleibt so unangetastet, sie ist dann nur schreibgeschützt.
 */
export function demoMayReset(usernames: string[]): boolean {
  return usernames.every((u) => u === DEMO_USERNAME);
}
