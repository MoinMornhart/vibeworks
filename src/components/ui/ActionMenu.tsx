"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

// Kleines Aktionsmenü („…“). Per Portal am <body>, damit Scroll-Container
// (z. B. die Seitenleiste) es nicht abschneiden.
export function ActionMenu({ label, items, className }: { label: string; items: ActionItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 208;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = window.innerHeight - r.bottom;
    setStyle(below < 240 && r.top > below ? { position: "fixed", left, width, bottom: window.innerHeight - r.top + 4 } : { position: "fixed", left, width, top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    // Ohne Scrollen fokussieren und den Scroll-Wächter erst danach anhängen –
    // sonst schließt das vom Fokus ausgelöste Mini-Scrollen das Menü sofort.
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => window.addEventListener("scroll", onScroll, true));
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn("rounded p-1 text-muted hover:bg-fg/10 hover:text-fg", className)}
      >
        <MoreHorizontal size={15} />
      </button>
      {open &&
        createPortal(
          <div ref={menu} role="menu" style={style} className="glass-strong fade-in z-[60] p-1">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-fg/10 focus:bg-fg/10 focus:outline-none disabled:opacity-40",
                  item.danger && "text-red-400",
                )}
              >
                {item.icon && <item.icon size={14} />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
