"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { choiceDialog } from "./dialogs";

// Entwürfe: was man gerade schreibt, bleibt im Browser erhalten, wenn man die
// Seite verlässt oder neu lädt – bis es abgeschickt oder verworfen wird. Nur
// für Neues (beim Bearbeiten würde ein alter Entwurf neuere Stände
// überschreiben) und nie für Anmeldedaten. Beim Abmelden ist alles weg.

const PREFIX = "vw-draft:";
const MAX_AGE_MS = 14 * 86_400_000;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at?: unknown; v?: T };
    if (typeof d?.at !== "number" || Date.now() - d.at > MAX_AGE_MS || d.v === undefined) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return d.v;
  } catch {
    return null;
  }
}

/**
 * Schließen mit Rückfrage (#109): Ist etwas ungespeichert, fragt ein eigener
 * Dialog – bei Neuem „Als Entwurf behalten / Verwerfen / Weiter schreiben“,
 * beim Bearbeiten „Änderungen verwerfen / Weiter bearbeiten“. Solange
 * Ungespeichertes bearbeitet wird, warnt zusätzlich der Browser beim Verlassen
 * der Seite (Entwürfe von Neuem bleiben ohnehin erhalten).
 */
export function useLeaveGuard(opts: { dirty: boolean; draftable: boolean; onDiscard?: () => void }) {
  const t = useT("common");
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    if (!opts.dirty || opts.draftable) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [opts.dirty, opts.draftable]);

  return useCallback(
    async (close: () => void) => {
      const { dirty, draftable, onDiscard } = ref.current;
      if (!dirty) return close();
      const choice = await choiceDialog(draftable ? t("leave.draftMessage") : t("leave.editMessage"), {
        title: t("leave.title"),
        choices: draftable
          ? [
              { key: "keep", label: t("leave.keep"), tone: "primary" },
              { key: "discard", label: t("leave.discard"), tone: "danger" },
              { key: "stay", label: t("leave.stay") },
            ]
          : [
              { key: "stay", label: t("leave.stay"), tone: "primary" },
              { key: "discard", label: t("leave.discardChanges"), tone: "danger" },
            ],
      });
      if (choice === null || choice === "stay") return;
      if (choice === "discard") onDiscard?.();
      close();
    },
    [t],
  );
}

/** Einen Entwurf vergessen – z. B. nachdem er gespeichert wurde. */
export function discardDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* Speicher gesperrt – dann gibt es auch keinen Entwurf */
  }
}

/** Alle Entwürfe löschen – beim Abmelden, damit auf geteilten Geräten nichts liegen bleibt. */
export function clearAllDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* s. o. */
  }
}

/**
 * Entwurf eines Formulars. key null heißt: gerade keiner (Dialog zu, Bearbeiten statt Neu).
 * restore setzt den gespeicherten Stand ins Formular, isEmpty sagt, wann es nichts zu merken gibt.
 * restored: beim Öffnen wurde ein Entwurf geladen · discard: Entwurf vergessen.
 */
export function useDraft<T>(key: string | null, value: T, restore: (v: T) => void, isEmpty: (v: T) => boolean) {
  const active = useRef<string | null>(null);
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(restore);
  const emptyRef = useRef(isEmpty);
  restoreRef.current = restore;
  emptyRef.current = isEmpty;

  // Laden – einmal, sobald der Schlüssel aktiv wird
  useEffect(() => {
    if (!key) {
      active.current = null;
      setRestored(false);
      return;
    }
    if (active.current === key) return;
    active.current = key;
    const saved = read<T>(key);
    const found = saved !== null && !emptyRef.current(saved);
    if (found) restoreRef.current(saved);
    setRestored(found);
  }, [key]);

  // Merken – kurz nach der letzten Eingabe
  useEffect(() => {
    if (!key || active.current !== key) return;
    const timer = window.setTimeout(() => {
      try {
        if (emptyRef.current(value)) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), v: value }));
      } catch {
        /* voll oder gesperrt – dann eben ohne Entwurf */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [key, value]);

  const discard = useCallback(() => {
    if (key) discardDraft(key);
    setRestored(false);
  }, [key]);

  return { restored, discard };
}
