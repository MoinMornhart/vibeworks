"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ProjectStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PROJECT_STATUSES } from "@/lib/status";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 288;
const MENU_HEIGHT = 380;

// Status direkt auf der Karte umschalten, ohne die Projektseite zu öffnen.
// Das Menü hängt per Portal am <body> und ist fest positioniert: Glasflächen
// (backdrop-filter) und Einblend-Animationen bilden eigene Stapelkontexte,
// in denen ein normales Popover von der nächsten Karte überdeckt würde.
export function StatusSelect({
  value,
  onChange,
  align = "right",
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
      let left = align === "right" ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom;
      const s: CSSProperties = { position: "fixed", left, width };
      if (below < MENU_HEIGHT && r.top > below) s.bottom = window.innerHeight - r.top + 6;
      else s.top = r.bottom + 6;
      setStyle(s);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="shrink-0 rounded-full"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Status ändern"
      >
        <StatusBadge status={value} className="cursor-pointer transition hover:brightness-125" />
      </button>
      {open &&
        createPortal(
          <ul ref={menuRef} role="listbox" aria-label="Status" style={style} className="glass-strong fade-in z-[60] p-1.5">
            {PROJECT_STATUSES.map((s) => (
              <li key={s.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s.value === value}
                  onClick={() => {
                    setOpen(false);
                    if (s.value !== value) onChange(s.value);
                  }}
                  className={cn("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-accent/10 focus:bg-accent/10 focus:outline-none", s.value === value && "bg-accent/10")}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: `var(${s.cssVar})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted">{s.hint}</span>
                  </span>
                  {s.value === value && <Check size={15} className="mt-0.5 text-accent-ink" />}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
