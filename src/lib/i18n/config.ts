// Sprachen der Oberfläche – ohne Abhängigkeiten, im Browser und auf dem Server nutzbar.

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "vw_locale";

/** Name jeder Sprache in ihr selbst – so findet man sie auch, wenn man die andere nicht lesen kann. */
export const LOCALE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English" };

/** Gebietsschema für Intl (Datum, Zahlen). Englisch britisch: Tag vor Monat, 24-Stunden-Uhr. */
export const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Erste unterstützte Sprache aus dem Accept-Language-Kopf, sonst Deutsch. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const base = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
