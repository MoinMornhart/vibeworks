"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Save, Send, XCircle } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { NOTIFY_EVENTS, splitLastError, type Channel, type EventSwitches, type NotifyEvent } from "@/lib/notify/format";
import { AccountSection } from "./AccountManager";

export interface NotificationSettingsView {
  ntfyUrl: string;
  hasNtfyToken: boolean;
  webhookUrl: string;
  email: string;
  events: EventSwitches;
  lastError: string | null;
  lastSentAt: string | null;
}

interface Result {
  channel: Channel;
  ok: boolean;
  error?: string;
}

export function NotificationsSection({ initial, smtpReady, isAdmin }: { initial: NotificationSettingsView; smtpReady: boolean; isAdmin: boolean }) {
  const t = useT("notify");
  const msg = useMsg();
  const f = useFormat();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState({ ntfyUrl: initial.ntfyUrl, webhookUrl: initial.webhookUrl, email: initial.email, events: initial.events });
  const [ntfyToken, setNtfyToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Result[] | null>(null);

  const events = NOTIFY_EVENTS.filter((e) => e !== "updated" || isAdmin);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((s) => ({ ...s, [key]: value }));
  const toggle = (e: NotifyEvent) => setForm((s) => ({ ...s, events: { ...s.events, [e]: !s.events[e] } }));

  async function save(extra: { ntfyToken?: string | null } = {}) {
    setBusy(true);
    setNotice(null);
    setError(null);
    setFieldErrors({});
    try {
      const token = extra.ntfyToken !== undefined ? extra.ntfyToken : ntfyToken.trim() ? ntfyToken.trim() : undefined;
      const res = await api<{ settings: NotificationSettingsView }>("/api/account/notifications", { method: "PUT", body: { ...form, ntfyToken: token } });
      setSaved(res.settings);
      setNtfyToken("");
      setNotice(t("saved"));
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    // Erst speichern, damit der Test die eingetragenen Kanäle nutzt
    if (!(await save())) return;
    setBusy(true);
    setResults(null);
    try {
      const res = await api<{ results: Result[]; settings: NotificationSettingsView }>("/api/account/notifications/test", { method: "POST", body: {} });
      setResults(res.results);
      setSaved(res.settings);
      setNotice(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const last = splitLastError(saved.lastError);

  return (
    <AccountSection icon={<Bell size={18} />} title={t("section.title")} description={t("section.description")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <label className="label" htmlFor="notify-ntfy">{t("ntfy.label")}</label>
          <input id="notify-ntfy" className="field font-mono text-sm" value={form.ntfyUrl} onChange={(e) => set("ntfyUrl", e.target.value)} placeholder={t("ntfy.placeholder")} maxLength={500} spellCheck={false} />
          {fieldErrors.ntfyUrl && <p className="mt-1 text-xs text-red-400">{fieldErrors.ntfyUrl}</p>}
          <p className="mt-1 text-xs text-muted">{t("ntfy.hint")}</p>
          {form.ntfyUrl && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="password"
                autoComplete="off"
                className="field min-w-0 flex-1 font-mono text-sm"
                value={ntfyToken}
                onChange={(e) => setNtfyToken(e.target.value)}
                placeholder={saved.hasNtfyToken ? t("ntfy.tokenSaved") : t("ntfy.token")}
                aria-label={t("ntfy.token")}
                maxLength={300}
              />
              {saved.hasNtfyToken && (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save({ ntfyToken: null })}>{t("ntfy.removeToken")}</button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="notify-webhook">{t("webhook.label")}</label>
          <input id="notify-webhook" className="field font-mono text-sm" value={form.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} placeholder={t("webhook.placeholder")} maxLength={1000} spellCheck={false} />
          {fieldErrors.webhookUrl && <p className="mt-1 text-xs text-red-400">{fieldErrors.webhookUrl}</p>}
          <p className="mt-1 text-xs text-muted">{t("webhook.hint")}</p>
        </div>

        <div>
          <label className="label" htmlFor="notify-email">{t("email.label")}</label>
          <input id="notify-email" type="email" className="field" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("email.placeholder")} maxLength={254} disabled={!smtpReady && !form.email} />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
          {!smtpReady && <p className="mt-1 text-xs text-amber-400">{t("email.noSmtp")}</p>}
        </div>

        <fieldset>
          <legend className="label">{t("switches.title")}</legend>
          <div className="space-y-2">
            {events.map((e) => (
              <label key={e} className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--vw-accent)]" checked={form.events[e]} onChange={() => toggle(e)} />
                {t(`switches.${e}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            <Save size={14} /> {t("save")}
          </button>
          <button type="button" className="btn btn-sm" disabled={busy || (!form.ntfyUrl && !form.webhookUrl && !form.email)} onClick={() => void test()}>
            <Send size={14} /> {busy ? t("testing") : t("test")}
          </button>
        </div>

        {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
        {results && (
          <ul className="space-y-1 text-sm" aria-live="polite">
            {results.map((r) => (
              <li key={r.channel} className={r.ok ? "flex items-start gap-2 text-emerald-400" : "flex items-start gap-2 text-red-400"}>
                {r.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
                {r.ok ? t("testOk", { channel: t(`channel.${r.channel}`) }) : t("testFailed", { channel: t(`channel.${r.channel}`), error: msg(r.error ?? "") })}
              </li>
            ))}
          </ul>
        )}
        {!results && last && (
          <p className="text-xs text-red-400">{t("lastError", { channel: last.channel ? t(`channel.${last.channel}`) : "–", error: msg(last.error) })}</p>
        )}
        {saved.lastSentAt && <p className="text-xs text-muted" suppressHydrationWarning>{t("lastSent", { ago: f.ago(saved.lastSentAt) })}</p>}
        <FormError message={error} />
      </form>
    </AccountSection>
  );
}
