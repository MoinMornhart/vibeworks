"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Barrierearmer Dialog: Esc und Klick auf den Hintergrund schließen, der
// Fokus springt hinein und beim Schließen zurück, Tab bleibt im Dialog.

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // onClose über eine Ref: Eltern übergeben meist eine Inline-Funktion. Hinge
  // der Effekt davon ab, liefe er bei jedem Neurendern erneut und risse beim
  // Tippen nach jedem Zeichen den Fokus aus dem Eingabefeld.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []);
    // Hat React per autoFocus schon ein Feld im Dialog fokussiert, bleibt es
    // dabei. Sonst das erste Eingabefeld – nicht der Schließen-Knopf.
    if (!node?.contains(document.activeElement)) {
      const list = focusables();
      (list.find((el) => el.matches("input,textarea,select")) ?? list[0] ?? node)?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const list = focusables();
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  return createPortal(
    // Auf dem Handy oben statt am unteren Rand: dort schiebt sich beim Tippen
    // die Bildschirmtastatur über den Dialog.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 pb-3 pt-[max(1rem,6dvh)] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("glass-strong fade-in relative flex max-h-[88dvh] w-full flex-col rounded-2xl", width)}
      >
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
