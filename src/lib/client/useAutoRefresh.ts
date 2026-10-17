"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Läuft gerade eine Eingabe? Dann nicht dazwischenfunken. */
function isBusy(): boolean {
  if (document.querySelector('[aria-modal="true"]')) return true;
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Kurzer Änderungsstempel: Neu geladen wird erst, wenn er sich ändert (#214). */
type Stamp = { url: string; value: string };

/**
 * Holt den Serverstand neu, wenn man zum Tab zurückkehrt und sonst in festen
 * Abständen – so erscheinen Änderungen aus einem anderen Tab, von einem
 * anderen Gerät oder aus dem Git-Abgleich ohne Neuladen.
 *
 * Mit `stamp` fragt der Browser zuerst nur den Stempel ab und baut die Seite
 * nur dann neu auf, wenn sich etwas geändert hat. Auf der Projektseite spart
 * das bei jedem Takt den kompletten Neuaufbau samt Repo-Daten.
 */
export function useAutoRefresh(intervalMs = 60_000, stamp?: Stamp) {
  const router = useRouter();
  const known = useRef(stamp?.value);
  // Nach einem Neuaufbau kommt der neue Stempel als Eigenschaft mit
  useEffect(() => {
    known.current = stamp?.value;
  }, [stamp?.value]);
  const url = stamp?.url;
  useEffect(() => {
    let last = Date.now();
    const refresh = async () => {
      if (document.visibilityState !== "visible" || isBusy() || Date.now() - last < 5_000) return;
      last = Date.now();
      if (url) {
        let next: unknown;
        try {
          const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
          next = res.ok ? ((await res.json()) as { stamp?: unknown }).stamp : null;
        } catch {
          return; // Netz weg – beim nächsten Takt wieder
        }
        // Erst merken, wenn wirklich neu geladen wird – sonst ginge die Änderung verloren
        if (typeof next !== "string" || next === known.current || isBusy()) return;
        known.current = next;
      }
      router.refresh();
    };
    const onEvent = () => void refresh();
    document.addEventListener("visibilitychange", onEvent);
    window.addEventListener("focus", onEvent);
    const timer = window.setInterval(onEvent, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", onEvent);
      window.removeEventListener("focus", onEvent);
      window.clearInterval(timer);
    };
  }, [router, intervalMs, url]);
}

export function AutoRefresh({ intervalMs, stamp }: { intervalMs?: number; stamp?: Stamp }) {
  useAutoRefresh(intervalMs, stamp);
  return null;
}
