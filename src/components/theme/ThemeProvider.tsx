"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { themeCss } from "@/lib/theme/css";
import type { Theme } from "@/lib/theme";

// Hält das gespeicherte Design und eine optionale Live-Vorschau aus dem
// Editor. Die Vorschau ersetzt die CSS-Variablen sofort, ohne zu speichern;
// verlässt man den Editor ohne Speichern, springt alles zurück.

interface ThemeContextValue {
  /** Aktives Design (Vorschau, falls gesetzt) */
  theme: Theme;
  /** Gespeichertes Design */
  saved: Theme;
  preview: (theme: Theme | null) => void;
  commit: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Theme | null>(null);
  const theme = draft ?? saved;

  // Server liefert nach Anmelden/Abmelden ein anderes Design – übernehmen.
  useEffect(() => {
    setSaved(initial);
  }, [initial]);

  useEffect(() => {
    const el = document.getElementById("vw-theme");
    if (el) el.textContent = themeCss(theme);
  }, [theme]);

  const preview = useCallback((t: Theme | null) => setDraft(t), []);
  const commit = useCallback((t: Theme) => {
    setSaved(t);
    setDraft(null);
  }, []);

  const value = useMemo(() => ({ theme, saved, preview, commit }), [theme, saved, preview, commit]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme außerhalb des ThemeProvider");
  return ctx;
}
