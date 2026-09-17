"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Circle, CircleCheck, Filter, ListChecks, Save, Settings, Sparkles, Trash2 } from "lucide-react";
import type { NotificationCenterView } from "@/lib/notify/center";
import { parseRuleList } from "@/lib/notify/rulesLogic";
import { api, errorMessage } from "@/lib/client/api";
import { confirmDialog } from "@/lib/client/dialogs";
import { toast } from "@/components/ui/Toaster";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Item = NotificationCenterView["items"][number];
const STEP = 50;

/** Meldungen-Seite (#109): alle Benachrichtigungen mit Filtern, Regeln und passenden Aufgaben. */
export function NotificationCenter({ initial }: { initial: NotificationCenterView }) {
  const t = useT("notices");
  const tn = useT("notify");
  const ts = useT("status");
  const f = useFormat();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [event, setEvent] = useState("");
  const [unread, setUnread] = useState(false);
  const [limit, setLimit] = useState(STEP);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState(initial.rules.words.join("\n"));
  const [people, setPeople] = useState(initial.rules.people.join("\n"));
  const [projects, setProjects] = useState<string[]>(initial.rules.projects);

  const load = useCallback(
    async (opts: { q: string; event: string; unread: boolean; limit: number }) => {
      const params = new URLSearchParams({ limit: String(opts.limit) });
      if (opts.q) params.set("q", opts.q);
      if (opts.event) params.set("event", opts.event);
      if (opts.unread) params.set("unread", "1");
      try {
        setData((await api<{ center: NotificationCenterView }>(`/api/notifications/center?${params}`)).center);
      } catch (e) {
        toast(errorMessage(e), "error");
      }
    },
    [],
  );

  // Filter wirken mit kurzer Verzögerung – so tippt es sich flüssig
  useEffect(() => {
    const id = window.setTimeout(() => void load({ q, event, unread, limit }), 250);
    return () => window.clearTimeout(id);
  }, [q, event, unread, limit, load]);

  async function bulk(action: "read" | "unread" | "delete") {
    const ids = [...picked];
    if (!ids.length) return;
    if (action === "delete" && !(await confirmDialog(t("confirmDelete", { n: ids.length }), { danger: true }))) return;
    setBusy(true);
    try {
      await api("/api/notifications", { body: { action, ids } });
      setPicked(new Set());
      await load({ q, event, unread, limit });
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRead(n: Item) {
    await api(`/api/notifications/${n.id}`, { method: "PATCH", body: { read: !n.read } }).catch((e) => toast(errorMessage(e), "error"));
    await load({ q, event, unread, limit });
    router.refresh();
  }

  async function saveRules() {
    setBusy(true);
    try {
      const res = await api<{ center: NotificationCenterView }>("/api/notifications/center", {
        method: "PUT",
        body: { words: parseRuleList(words), people: parseRuleList(people), projects },
      });
      setData(res.center);
      setWords(res.center.rules.words.join("\n"));
      setPeople(res.center.rules.people.join("\n"));
      setProjects(res.center.rules.projects);
      toast(t("rules.saved"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const allPicked = data.items.length > 0 && data.items.every((n) => picked.has(n.id));
  return (
    <div className="fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Bell size={28} className="text-accent-ink" /> {t("title")}
          </h1>
          <p className="mt-1 text-muted">{t("subtitle")}</p>
        </div>
        <Link href="/account#benachrichtigungen" className="btn btn-sm">
          <Settings size={14} /> {t("channels")}
        </Link>
      </header>

      <section className="glass p-5 sm:p-6" data-testid="notices-list">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Filter size={14} /> {t("filters.count", { n: data.total })}
          </span>
          <input className="field w-full sm:w-64" placeholder={t("filters.searchPlaceholder")} aria-label={t("filters.search")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="notices-search" />
          <select className="field !w-auto" aria-label={t("filters.event")} value={event} onChange={(e) => setEvent(e.target.value)} data-testid="notices-event">
            <option value="">{t("filters.allEvents")}</option>
            {data.known.map((e) => (
              <option key={e} value={e}>
                {tn(`switches.${e}`).split(" – ")[0].split(" (")[0]}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--vw-accent)]" checked={unread} onChange={(e) => setUnread(e.target.checked)} data-testid="notices-unread" />
            {t("filters.unread")} {data.unread > 0 && <span className="chip !py-0.5 text-[11px]">{data.unread}</span>}
          </label>
          <span className="ml-auto flex items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                className="size-4 accent-[var(--vw-accent)]"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(data.items.map((n) => n.id)))}
                aria-label={t("selectAll")}
                data-testid="notices-select-all"
              />
              {picked.size ? t("selected", { n: picked.size }) : t("selectAll")}
            </label>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={busy || !picked.size} onClick={() => void bulk("read")} aria-label={t("markRead")} title={t("markRead")}>
              <CheckCheck size={15} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm hover:!text-red-400"
              disabled={busy || !picked.size}
              onClick={() => void bulk("delete")}
              aria-label={t("delete")}
              title={t("delete")}
              data-testid="notices-delete"
            >
              <Trash2 size={15} />
            </button>
          </span>
        </div>

        {data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("filters.empty")}</p>
        ) : (
          <ul className="space-y-1">
            {data.items.map((n) => (
              <li
                key={n.id}
                className={cn("flex items-start gap-2 rounded-xl border px-3 py-2", !n.read && "bg-accent/5", n.important && "border-amber-500/50", picked.has(n.id) && "bg-accent/15")}
                data-testid="notice"
              >
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 shrink-0 accent-[var(--vw-accent)]"
                  checked={picked.has(n.id)}
                  onChange={() =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (next.has(n.id)) next.delete(n.id);
                      else next.add(n.id);
                      return next;
                    })
                  }
                  aria-label={n.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.url ? (
                      <Link href={n.url.replace(/^https?:\/\/[^/]+/, "")} className={cn("text-sm hover:text-accent-ink", !n.read && "font-semibold")}>
                        {n.title}
                      </Link>
                    ) : (
                      <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    )}
                    {n.important && (
                      <span className="chip !py-0 border-amber-500/50 text-[11px] text-amber-400" data-testid="notice-important">
                        <Sparkles size={11} /> {t("important")}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted" suppressHydrationWarning>
                      {f.ago(n.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line break-words text-xs text-muted">{n.message}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  onClick={() => void toggleRead(n)}
                  aria-label={n.read ? t("markUnread") : t("markRead")}
                  title={n.read ? t("markUnread") : t("markRead")}
                >
                  {n.read ? <Circle size={14} /> : <CircleCheck size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {data.items.length >= limit && (
          <button type="button" className="btn btn-sm mt-3" onClick={() => setLimit((l) => l + STEP)}>
            {t("filters.more")}
          </button>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass p-5 sm:p-6" data-testid="notice-rules">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles size={18} className="text-accent-ink" /> {t("rules.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("rules.description")}</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="label">{t("rules.words")}</span>
              <textarea className="field min-h-20" value={words} onChange={(e) => setWords(e.target.value)} data-testid="rules-words" placeholder="dringend, Sicherheit" />
              <span className="mt-1 block text-xs text-muted">{t("rules.wordsHint")}</span>
            </label>
            <label className="block">
              <span className="label">{t("rules.people")}</span>
              <textarea className="field min-h-16" value={people} onChange={(e) => setPeople(e.target.value)} data-testid="rules-people" placeholder="JONIMONI09" />
              <span className="mt-1 block text-xs text-muted">{t("rules.peopleHint")}</span>
            </label>
            <div>
              <span className="label">{t("rules.projects")}</span>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-testid="rules-projects">
                {data.projects.map((p) => {
                  const on = projects.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn("chip !py-0.5 text-xs", on && "chip-active")}
                      aria-pressed={on}
                      onClick={() => setProjects((list) => (on ? list.filter((x) => x !== p.id) : [...list, p.id]))}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1 block text-xs text-muted">{t("rules.projectsHint")}</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveRules()} data-testid="rules-save">
              <Save size={14} /> {t("rules.save")}
            </button>
          </div>
        </section>

        <section className="glass p-5 sm:p-6" data-testid="notice-tasks">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks size={18} className="text-accent-ink" /> {t("tasks.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("tasks.description")}</p>
          {data.rules.words.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("tasks.none")}</p>
          ) : data.matchingTasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("tasks.empty")}</p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {data.matchingTasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5 text-sm" data-testid="notice-task">
                  <span className="chip !py-0.5 text-[11px]">{ts(`task.${task.status}`)}</span>
                  <Link href={`/projects/${task.projectId}?aufgabe=${task.id}#tasks`} className="min-w-0 flex-1 truncate hover:text-accent-ink">
                    {task.title}
                  </Link>
                  <span className="text-xs text-muted">{task.project}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
