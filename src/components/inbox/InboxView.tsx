"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Inbox, Lightbulb, ListPlus, Pencil, Send, Share2, Trash2, Webhook } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import type { InboxEntry } from "@/lib/inboxServer";

const SOURCE_ICON = { share: Share2, webhook: Webhook, ntfy: Bell, manual: Pencil } as const;

/** Ideen-Eingang: einwerfen, dann zu Projekt oder Aufgabe machen – oder verwerfen. */
export function InboxView({ initial, projects }: { initial: InboxEntry[]; projects: Array<{ id: string; name: string }> }) {
  const t = useT("inbox");
  const f = useFormat();
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href: string } | null>(null);
  const [taskFor, setTaskFor] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  const drop = (id: string) => setItems((list) => list.filter((x) => x.id !== id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ item: InboxEntry | null }>("/api/inbox", { body: { text } });
      if (res.item) setItems((list) => [res.item!, ...list]);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toProject(item: InboxEntry) {
    setError(null);
    try {
      const res = await api<{ project: { id: string; name: string } }>(`/api/inbox/${item.id}`, { body: { action: "project" } });
      drop(item.id);
      setNotice({ text: t("toProjectDone", { name: res.project.name }), href: `/projects/${res.project.id}` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function toTask(item: InboxEntry) {
    setError(null);
    try {
      const res = await api<{ task: { title: string }; project: { id: string; name: string } }>(`/api/inbox/${item.id}`, { body: { action: "task", projectId } });
      drop(item.id);
      setTaskFor(null);
      setNotice({ text: t("toTaskDone", { title: res.task.title, project: res.project.name }), href: `/projects/${res.project.id}` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function dismiss(item: InboxEntry) {
    setError(null);
    try {
      await api(`/api/inbox/${item.id}`, { method: "DELETE" });
      drop(item.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight"><Inbox size={26} className="text-accent-ink" /> {t("title")}</h1>
          <p className="mt-1 text-muted">{t("subtitle")}</p>
        </div>
        <Link href="/account#inbox" className="btn btn-sm">{t("setup")}</Link>
      </header>

      <form onSubmit={add} className="glass flex flex-wrap gap-2 p-3">
        <input className="field min-w-0 flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("placeholder")} maxLength={4000} aria-label={t("placeholder")} />
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}><Send size={14} /> {t("add")}</button>
      </form>

      {notice && (
        <p role="status" className="text-sm text-emerald-400">
          {notice.text} <Link href={notice.href} className="underline">{t("open")}</Link>
        </p>
      )}
      <FormError message={error} />

      {items.length === 0 ? (
        <div className="glass px-6 py-14 text-center">
          <p className="text-4xl" aria-hidden>📭</p>
          <p className="mt-2 font-medium">{t("empty")}</p>
          <p className="mt-1 text-sm text-muted">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon = SOURCE_ICON[item.source] ?? Pencil;
            return (
              <li key={item.id} data-testid="inbox-item" className="glass p-4">
                <div className="flex items-start gap-3">
                  <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-label={t(`source.${item.source}`)} />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-accent-ink hover:underline">{item.url}</a>
                    )}
                    <p className="mt-1 text-xs text-muted" suppressHydrationWarning>{t(`source.${item.source}`)} · {f.ago(item.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                  <button className="btn btn-sm" onClick={() => void toProject(item)}><Lightbulb size={14} /> {t("toProject")}</button>
                  {taskFor === item.id ? (
                    <>
                      <select className="field !w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t("project")}>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button className="btn btn-primary btn-sm" disabled={!projectId} onClick={() => void toTask(item)}>{t("confirmTask")}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setTaskFor(null)}>{t("cancel")}</button>
                    </>
                  ) : (
                    <button className="btn btn-sm" disabled={projects.length === 0} onClick={() => setTaskFor(item.id)}><ListPlus size={14} /> {t("toTask")}</button>
                  )}
                  <button className="btn btn-ghost btn-sm ml-auto" onClick={() => void dismiss(item)}><Trash2 size={14} /> {t("dismiss")}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
