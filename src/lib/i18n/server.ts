import { cookies, headers } from "next/headers";
import { cache } from "react";
import { currentUser } from "@/lib/auth/guard";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "./config";
import { makeT, translateMessage, type Namespace } from "./messages";

/**
 * Sprache der aktuellen Anfrage: Einstellung des Kontos, sonst das Cookie
 * (Anmeldeseite), sonst die Browsersprache.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const own = (await currentUser())?.locale;
    if (isLocale(own)) return own;
  } catch {
    // Datenbank nicht erreichbar – dann eben Cookie oder Browser
  }
  try {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookie)) return cookie;
    return localeFromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
});

/** Übersetzer für Server-Komponenten und Routen: const t = await getT("projects"). */
export async function getT<N extends Namespace>(ns: N) {
  return makeT(await getLocale(), ns);
}

/** Meldungsschlüssel ("git.errors.http?status=500") in die Sprache der Anfrage übersetzen. */
export async function translateForRequest(text: string): Promise<string> {
  return translateMessage(await getLocale(), text);
}
