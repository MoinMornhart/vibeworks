"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { makeT, translateMessage, type Namespace } from "./messages";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { formatDue } from "@/lib/taskDates";

const LocaleContext = createContext<Locale>("de");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Übersetzer für Client-Komponenten: const t = useT("projects"); t("board.title"). */
export function useT<N extends Namespace>(ns: N) {
  const locale = useLocale();
  return useMemo(() => makeT(locale, ns), [locale, ns]);
}

/** Übersetzt Meldungen, die als Schlüssel ankommen (z. B. gespeicherte Git-Fehler); normaler Text bleibt. */
export function useMsg() {
  const locale = useLocale();
  return useMemo(() => (text: string) => translateMessage(locale, text), [locale]);
}

/** Datum und Zeit in der Sprache der Oberfläche. */
export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      date: (d: Date | string | null | undefined) => formatDate(d, locale),
      dateTime: (d: Date | string | null | undefined) => formatDateTime(d, locale),
      ago: (d: Date | string | null | undefined, now?: number) => timeAgo(d, now, locale),
      due: (dueKey: string, todayKey: string) => formatDue(dueKey, todayKey, locale),
    }),
    [locale],
  );
}
