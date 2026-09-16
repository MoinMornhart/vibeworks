"use client";

import { useEffect, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

// Kurze Rückmeldungen, die man nicht übersieht (#63): unten fest am Rand,
// für Screenreader angesagt, nach ein paar Sekunden wieder weg.

type Kind = "success" | "error";
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

const EVENT = "vw-toast";
let seq = 0;

/** Von überall aufrufbar – zeigt die Meldung im Toaster des Layouts. */
export function toast(text: string, kind: Kind = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: ++seq, text, kind } }));
}

export function Toaster() {
  const t = useT("common");
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const item = (e as CustomEvent<Toast>).detail;
      setItems((list) => [...list.slice(-3), item]);
      window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== item.id)), 5000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end" role="status" aria-live="polite" data-testid="toaster">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "glass-strong fade-in pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-xl",
            item.kind === "success" ? "border-emerald-500/50" : "border-red-500/50",
          )}
          data-testid="toast"
        >
          {item.kind === "success" ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-400" />}
          <span className="min-w-0 flex-1 break-words">{item.text}</span>
          <button type="button" className="shrink-0 text-muted hover:text-fg" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))} aria-label={t("close")}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
