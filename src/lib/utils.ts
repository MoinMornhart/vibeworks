import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "ae", Ö: "oe", Ü: "ue" };

/** URL-tauglicher Kurzname, umlautfest, höchstens 60 Zeichen. */
export function slugify(input: string): string {
  const slug = input
    .replace(/[äöüßÄÖÜ]/g, (c) => UMLAUTS[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "projekt";
}

/** Tags kleinschreiben, trimmen, doppelte entfernen, höchstens `max`. */
export function normalizeTags(input: string[] | string, max = 12): string[] {
  const list = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  for (const raw of list) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32);
    if (tag) seen.add(tag);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export const TIME_ZONE = "Europe/Berlin";

// Formatierer je Sprache, einmal angelegt und wiederverwendet.
const dateFmts = new Map<string, Intl.DateTimeFormat>();
function dateFmt(locale: Locale, withTime: boolean): Intl.DateTimeFormat {
  const id = `${locale}:${withTime}`;
  let f = dateFmts.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
    dateFmts.set(id, f);
  }
  return f;
}

export function formatDate(d: Date | string | null | undefined, locale: Locale = "de"): string {
  return d ? dateFmt(locale, false).format(new Date(d)) : "–";
}

export function formatDateTime(d: Date | string | null | undefined, locale: Locale = "de"): string {
  return d ? dateFmt(locale, true).format(new Date(d)) : "–";
}

const rtfs = new Map<Locale, Intl.RelativeTimeFormat>();
function rtfFor(locale: Locale): Intl.RelativeTimeFormat {
  let r = rtfs.get(locale);
  if (!r) rtfs.set(locale, (r = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" })));
  return r;
}

/** „vor 3 Tagen“ / „3 days ago“, „gerade eben“ / „just now“ … */
export function timeAgo(d: Date | string | null | undefined, now = Date.now(), locale: Locale = "de"): string {
  if (!d) return "–";
  const rtf = rtfFor(locale);
  const diff = (new Date(d).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return locale === "en" ? "just now" : "gerade eben";
  const steps: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
    [Infinity, "year"],
  ];
  const divisors: Record<string, number> = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  for (const [limit, unit] of steps) {
    if (abs < limit) return rtf.format(Math.round(diff / divisors[unit]), unit);
  }
  return formatDate(d, locale);
}

/** Kalendertag „YYYY-MM-DD“ in Europe/Berlin. */
export function dayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}
