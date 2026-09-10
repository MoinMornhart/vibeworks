"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FolderKanban, LayoutDashboard, ListChecks, Palette, Search, Shield, StickyNote, UserRound } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import type { SearchResult } from "@/lib/search";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Highlight } from "./Highlight";

export const OPEN_PALETTE_EVENT = "vw:palette";

interface Item {
  key: string;
  group: string;
  label: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  href: string;
}

// Schnellsuche mit Strg+K / Cmd+K. Die Projektliste wird beim ersten Öffnen
// geholt und behalten; Notizen und Aufgaben sucht der Server im Volltext.
export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResult(null);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (projects === null) {
      api<{ projects: ProjectListItem[] }>("/api/projects?archived=1")
        .then((r) => setProjects(r.projects))
        .catch(() => setProjects([]));
    }
  }, [open, projects]);

  // Volltextsuche entprellt, erst ab zwei Zeichen
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResult(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(setResult)
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const list: Item[] = [];
    const matching = (projects ?? [])
      .filter((p) => !q || [p.name, p.summary ?? "", ...p.tags].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, q ? 8 : 5);
    for (const p of matching) {
      list.push({
        key: `p-${p.id}`,
        group: q ? "Projekte" : "Zuletzt bearbeitet",
        label: p.name,
        hint: p.summary ?? undefined,
        icon: <FolderKanban size={16} />,
        href: `/projects/${p.id}`,
      });
    }
    for (const n of result?.notes ?? []) {
      list.push({
        key: `n-${n.id}`,
        group: "Notizen",
        label: <>{n.title ? `${n.title} · ` : ""}<span className="text-muted">{n.projectName}</span></>,
        hint: <Highlight text={n.snippet} />,
        icon: <StickyNote size={16} />,
        href: `/projects/${n.projectId}`,
      });
    }
    for (const t of result?.tasks ?? []) {
      list.push({
        key: `t-${t.id}`,
        group: "Aufgaben",
        label: <>{t.title} · <span className="text-muted">{t.projectName}</span></>,
        hint: <Highlight text={t.snippet} />,
        icon: <ListChecks size={16} />,
        href: `/projects/${t.projectId}`,
      });
    }
    for (const d of result?.docs ?? []) {
      list.push({
        key: `d-${d.id}`,
        group: "Docs",
        label: <>{d.icon ? `${d.icon} ` : ""}{d.title}</>,
        hint: <Highlight text={d.snippet} />,
        icon: <BookOpen size={16} />,
        href: `/docs/${d.id}`,
      });
    }
    const areas = [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard size={16} /> },
      { label: "Aufgaben", href: "/tasks", icon: <ListChecks size={16} /> },
      { label: "Docs", href: "/docs", icon: <BookOpen size={16} /> },
      { label: "Design", href: "/design", icon: <Palette size={16} /> },
      { label: "Mein Konto", href: "/account", icon: <UserRound size={16} /> },
      ...(isAdmin ? [{ label: "Administration", href: "/admin", icon: <Shield size={16} /> }] : []),
    ].filter((a) => !q || a.label.toLowerCase().includes(q));
    for (const a of areas) list.push({ key: `a-${a.href}`, group: "Bereiche", ...a });
    return list;
  }, [projects, result, query, isAdmin]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: Item | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Schnellsuche" className="glass-strong fade-in relative flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Projekte, Notizen, Aufgaben, Docs …"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
            aria-label="Suchbegriff"
          />
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[11px] text-muted sm:inline">Esc</kbd>
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nichts gefunden.</li>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.key} role="presentation">
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <button
                  id={`palette-${item.key}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left", i === active && "bg-accent/15")}
                >
                  <span className="mt-0.5 shrink-0 text-muted">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.label}</span>
                    {item.hint && <span className="line-clamp-2 block text-xs text-muted">{item.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t px-4 py-2 text-[11px] text-muted">↑↓ wählen · Enter öffnen · Esc schließen</p>
      </div>
    </div>
  );
}
