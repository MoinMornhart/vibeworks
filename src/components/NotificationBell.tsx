"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Circle, CircleCheck, ListChecks, Settings, Trash2 } from "lucide-react";
import type { BellState } from "@/lib/notify/bell";
import { api } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/client/dialogs";
import { toast } from "@/components/ui/Toaster";

type Item = BellState["items"][number];

// Neue Benachrichtigungen einmal pro Minute nachsehen – nur, solange der Tab sichtbar ist.
const POLL_MS = 60_000;

/** Glocke in der Kopfleiste: neueste Benachrichtigungen ansehen, öffnen, als gelesen markieren, löschen. */
export function NotificationBell() {
  const t = useT("shell");
  const f = useFormat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BellState | null>(null);
  // Auswahl-Modus (#109): mehrere markieren, dann gelesen setzen oder löschen
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<BellState>("/api/notifications?list=1")
      .then(setState)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) {
      setPicked(null);
      return;
    }
    load();
    const close = (e: MouseEvent | KeyboardEvent) => {
      // Offene Rückfrage (eigener Dialog) liegt außerhalb – sie schließt die Glocke nicht
      if (!(e instanceof KeyboardEvent) && (e.target as Element | null)?.closest?.("[role=dialog][aria-modal=true]")) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true]") : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, load]);

  const send = (path: string, init: Parameters<typeof api>[1]) =>
    api<BellState>(path, init)
      .then(setState)
      .catch(() => load());
  const setRead = (n: Item, read: boolean) => send(`/api/notifications/${n.id}`, { method: "PATCH", body: { read } });
  const remove = (n: Item) => send(`/api/notifications/${n.id}`, { method: "DELETE" });
  const readAll = () => send("/api/notifications", { method: "PATCH", body: { read: true } });

  async function bulk(action: "read" | "delete" | "deleteAll") {
    const ids = [...(picked ?? [])];
    if (action !== "deleteAll" && !ids.length) return;
    if (action === "delete" && !(await confirmDialog(t("topNav.bell.confirmDelete", { n: ids.length }), { danger: true }))) return;
    if (action === "deleteAll" && !(await confirmDialog(t("topNav.bell.confirmClearAll"), { danger: true }))) return;
    try {
      const res = await api<BellState & { count: number }>("/api/notifications", { body: action === "deleteAll" ? { action } : { action, ids } });
      setState(res);
      setPicked(action === "read" ? new Set() : null);
      if (action !== "read") toast(t("topNav.bell.deleted", { n: res.count }));
    } catch {
      load();
    }
  }
  const togglePick = (id: string) =>
    setPicked((p) => {
      const next = new Set(p ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Ziele sind immer Seiten dieser Instanz – nur Pfad übernehmen, so führt kein Link nach außen.
  function openItem(n: Item) {
    if (!n.read) void setRead(n, true);
    if (!n.url) return;
    try {
      const u = new URL(n.url, window.location.origin);
      setOpen(false);
      router.push(`${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* kaputte Adresse – bleibt einfach offen */
    }
  }

  const unread = state?.unread ?? 0;
  const items = state?.items ?? [];
  const allPicked = picked !== null && items.length > 0 && items.every((n) => picked.has(n.id));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm relative"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t("topNav.bell.openUnread", { n: unread }) : t("topNav.bell.title")}
        title={t("topNav.bell.title")}
        data-testid="bell"
      >
        <Bell size={16} className={cn(unread > 0 && "bell-ring")} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-on-accent" data-testid="bell-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        // Handy: über die ganze Breite unter der Leiste – rechts neben der Glocke sitzt noch das Profil, rechtsbündig ragte das Panel links hinaus
        <div
          role="dialog"
          aria-label={t("topNav.bell.title")}
          className="glass-strong fade-in fixed inset-x-3 top-[4.25rem] p-1.5 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
          data-testid="bell-panel"
        >
          {picked ? (
            <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5" data-testid="bell-select-bar">
              <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--vw-accent)]" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(items.map((n) => n.id)))} data-testid="bell-select-all" />
                {picked.size ? t("topNav.bell.selected", { n: picked.size }) : t("topNav.bell.selectAll")}
              </label>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={!picked.size} onClick={() => void bulk("read")} aria-label={t("topNav.bell.readSelected")} title={t("topNav.bell.readSelected")}>
                <CheckCheck size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" disabled={!picked.size} onClick={() => void bulk("delete")} aria-label={t("topNav.bell.deleteSelected")} title={t("topNav.bell.deleteSelected")} data-testid="bell-delete-selected">
                <Trash2 size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm text-xs" onClick={() => setPicked(null)}>
                {t("topNav.bell.done")}
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <p className="mr-auto text-sm font-semibold">{t("topNav.bell.title")}</p>
            {items.length > 0 && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setPicked(new Set())} aria-label={t("topNav.bell.select")} title={t("topNav.bell.select")} data-testid="bell-select">
                <ListChecks size={14} />
              </button>
            )}
            {items.length > 0 && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" onClick={() => void bulk("deleteAll")} aria-label={t("topNav.bell.clearAll")} title={t("topNav.bell.clearAll")} data-testid="bell-clear-all">
                <Trash2 size={14} />
              </button>
            )}
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm text-xs" onClick={() => void readAll()}>
                <CheckCheck size={14} /> {t("topNav.bell.readAll")}
              </button>
            )}
            <Link href="/meldungen" className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label={t("topNav.bell.all")} title={t("topNav.bell.all")} data-testid="bell-all">
              <Settings size={14} />
            </Link>
          </div>
          )}
          {items.length === 0 ? (
            <p className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted">
              <BellOff size={20} /> {t("topNav.bell.empty")}
            </p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] space-y-0.5 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={cn("group flex items-start gap-1 rounded-xl px-1 transition hover:bg-fg/5", !n.read && "bg-accent/5", picked?.has(n.id) && "bg-accent/15")} data-testid="bell-item">
                  {picked && (
                    <input type="checkbox" className="mt-3 ml-1.5 size-4 shrink-0 accent-[var(--vw-accent)]" checked={picked.has(n.id)} onChange={() => togglePick(n.id)} aria-label={n.title} data-testid="bell-pick" />
                  )}
                  <button type="button" className="flex min-w-0 flex-1 items-start gap-2.5 px-1.5 py-2 text-left" onClick={() => (picked ? togglePick(n.id) : openItem(n))}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} aria-hidden />
                    <span className="min-w-0">
                      <span className={cn("block truncate text-sm", !n.read && "font-semibold")}>{n.title}</span>
                      <span className="line-clamp-2 whitespace-pre-line text-xs text-muted">{n.message}</span>
                      <span className="mt-0.5 block text-[11px] text-muted" suppressHydrationWarning>{f.ago(n.createdAt)}</span>
                    </span>
                  </button>
                  <span className={cn("flex shrink-0 flex-col py-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100", picked && "hidden")}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => void setRead(n, !n.read)}
                      aria-label={n.read ? t("topNav.bell.markUnread") : t("topNav.bell.markRead")}
                      title={n.read ? t("topNav.bell.markUnread") : t("topNav.bell.markRead")}
                    >
                      {n.read ? <Circle size={13} /> : <CircleCheck size={13} />}
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" onClick={() => void remove(n)} aria-label={t("topNav.bell.delete")} title={t("topNav.bell.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
