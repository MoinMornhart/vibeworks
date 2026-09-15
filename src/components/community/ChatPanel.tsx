"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Flag, Send, Trash2 } from "lucide-react";
import type { MessageItem } from "@/lib/community";
import { MAX_MESSAGE } from "@/lib/communityLogic";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useLocale, useT } from "@/lib/i18n/client";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { ReportForm } from "./PostThread";

/** Solange der Tab sichtbar ist, so oft nachsehen. */
const POLL_MS = 4000;

interface ChatState {
  messages: MessageItem[];
  canWrite: boolean;
  moderator: boolean;
}

/** Chat eines Raums (Lobby oder Projekt): reiner Text, Enter sendet, Moderation und Melden je Nachricht. */
export function ChatPanel({ room, title, hint }: { room: string; title: string; hint: string }) {
  const t = useT("community");
  const f = useFormat();
  const locale = useLocale();
  const [chat, setChat] = useState<ChatState | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    try {
      setChat(await api<ChatState>(`/api/community/chat/${room}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [room]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Neue Nachrichten: nach unten – außer man liest gerade weiter oben
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat?.messages]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      setChat(await api<ChatState>(`/api/community/chat/${room}`, { body: { body } }));
      setText("");
      stick.current = true;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" });

  return (
    <section id="chat" className="glass p-6 sm:p-8" aria-labelledby={`chat-${room}`}>
      <h2 id={`chat-${room}`} className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="max-h-96 space-y-2.5 overflow-y-auto rounded-xl border bg-bg/25 p-3"
        data-testid="chat-messages"
        aria-live="polite"
      >
        {chat && chat.messages.length === 0 && <li className="text-sm text-muted">{t("chat.empty")}</li>}
        {chat?.messages.map((m) => (
          <li key={m.id} className={cn("group flex gap-2", m.hidden && "opacity-60")}>
            <Avatar name={m.author.name} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-medium text-fg">{m.author.name}</span>
                {m.byOwner && <span className="rounded-full bg-accent/15 px-1.5 text-[10px] text-accent-ink">{t("owner")}</span>}
                <time dateTime={m.createdAt} title={f.ago(m.createdAt)} suppressHydrationWarning>{time(m.createdAt)}</time>
                {m.hidden && <span className="text-amber-400">{t("hiddenBadge")}</span>}
                <span className="ml-auto flex gap-1 sm:opacity-0 sm:transition sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                  {chat.moderator && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon !min-h-6 !p-1"
                      title={m.hidden ? t("actions.unhide") : t("actions.hide")}
                      aria-label={m.hidden ? t("actions.unhide") : t("actions.hide")}
                      onClick={() => void act(() => api(`/api/community/messages/${m.id}`, { method: "PATCH", body: { hidden: !m.hidden } }))}
                    >
                      {m.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  )}
                  {!m.mine && (
                    <button type="button" className="btn btn-ghost btn-icon !min-h-6 !p-1" title={t("actions.report")} aria-label={t("actions.report")} onClick={() => setReporting(reporting === m.id ? null : m.id)}>
                      <Flag size={12} />
                    </button>
                  )}
                  {m.canDelete && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon !min-h-6 !p-1 hover:!text-red-400"
                      title={t("actions.delete")}
                      aria-label={t("actions.delete")}
                      onClick={() => window.confirm(t("confirmDelete")) && void act(() => api(`/api/community/messages/${m.id}`, { method: "DELETE" }))}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              </p>
              {/* Chat bewusst als reiner Text */}
              <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
              {reporting === m.id && (
                <ReportForm target={{ type: "message", id: m.id }} onCancel={() => setReporting(null)} onDone={(msg) => (setReporting(null), setNotice(msg))} />
              )}
            </div>
          </li>
        ))}
      </ol>
      {chat && !chat.canWrite ? (
        <p className="mt-3 text-sm text-amber-400">{t("cannotWrite")}</p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          data-testid="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            className="field min-h-10 flex-1 resize-none"
            rows={1}
            maxLength={MAX_MESSAGE}
            value={text}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn btn-primary btn-sm self-end" disabled={busy || !text.trim()} aria-label={t("chat.send")}>
            <Send size={14} /> <span className="hidden sm:inline">{t("chat.send")}</span>
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs text-emerald-400">
          {notice}
        </p>
      )}
      <FormError message={error} />
    </section>
  );
}
