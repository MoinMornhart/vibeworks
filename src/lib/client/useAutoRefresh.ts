"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Läuft gerade eine Eingabe? Dann nicht dazwischenfunken. */
function isBusy(): boolean {
  if (document.querySelector('[aria-modal="true"]')) return true;
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Holt den Serverstand neu, wenn man zum Tab zurückkehrt und sonst in festen
 * Abständen – so erscheinen Änderungen aus einem anderen Tab, von einem
 * anderen Gerät oder aus dem Git-Abgleich ohne Neuladen.
 */
export function useAutoRefresh(intervalMs = 60_000) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || isBusy() || Date.now() - last < 5_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [router, intervalMs]);
}

export function AutoRefresh({ intervalMs }: { intervalMs?: number }) {
  useAutoRefresh(intervalMs);
  return null;
}
