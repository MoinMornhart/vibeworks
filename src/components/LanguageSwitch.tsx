"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

/** Deutsch | English – speichert die Wahl (Konto und Cookie) und lädt die Seite in der neuen Sprache. */
export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose(next: Locale) {
    if (next === locale || busy) return;
    setBusy(true);
    try {
      await api("/api/locale", { method: "PUT", body: { locale: next } });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="radiogroup" aria-label="Sprache / Language" className={cn("inline-flex rounded-xl border bg-bg/40 p-1 text-sm", className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          disabled={busy}
          onClick={() => void choose(l)}
          className={cn("rounded-lg px-3 py-1 transition", l === locale ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
