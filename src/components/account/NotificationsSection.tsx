"use client";

import { useState, type ReactNode } from "react";
import { Bell, CheckCircle2, Mail, Save, Send, Smartphone, Webhook, XCircle } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { Toggle } from "@/components/theme/controls";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { NOTIFY_GROUPS, splitLastError, type Channel, type EventSwitches, type NotifyEvent } from "@/lib/notify/format";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountManager";

export interface NotificationSettingsView {
  ntfyUrl: string;
  hasNtfyToken: boolean;
  webhookUrl: string;
  email: string;
  events: EventSwitches;
  urgentCritical: boolean;
  lastError: string | null;
  lastSentAt: string | null;
}

interface Result {
  channel: Channel;
  ok: boolean;
  error?: string;
}

/** Benachrichtigungen: Kanäle als Kacheln mit Status, Anlässe nach Themen gruppiert (je Gruppe alle an/aus). */
export function NotificationsSection({ initial, smtpReady, isAdmin }: { initial: NotificationSettingsView; smtpReady: boolean; isAdmin: boolean }) {
  const t = useT("notify");
  const msg = useMsg();
  const f = useFormat();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState({ ntfyUrl: initial.ntfyUrl, webhookUrl: initial.webhookUrl, email: initial.email, events: initial.events, urgentCritical: initial.urgentCritical });
  const [ntfyToken, setNtfyToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Result[] | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((s) => ({ ...s, [key]: value }));
  const toggle = (e: NotifyEvent) => setForm((s) => ({ ...s, events: { ...s.events, [e]: !s.events[e] } }));
  const setGroup = (list: readonly NotifyEvent[], on: boolean) =>
    setForm((s) => ({ ...s, events: { ...s.events, ...Object.fromEntries(list.map((e) => [e, on])) } }));

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

  const ChannelCard = ({ icon, title, active, children }: { icon: ReactNode; title: string; active: boolean; children: ReactNode }) => (
    <div className={cn("rounded-2xl border p-4 transition-colors", active ? "border-emerald-500/40 bg-emerald-500/5" : "bg-bg/25")} data-testid="notify-channel">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-accent-ink">{icon}</span>
        <span className="font-medium">{title}</span>
        <span className={cn("chip ml-auto !py-0.5 text-[11px]", active ? "border-emerald-500/40 text-emerald-400" : "text-muted")}>{active ? t("channelOn") : t("channelOff")}</span>
      </div>
      {children}
    </div>
  );

  return (
    <AccountSection id="benachrichtigungen" icon={<Bell size={18} />} title={t("section.title")} description={t("section.description")}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
          <Bell size={15} className="mt-0.5 shrink-0 text-accent-ink" /> {t("bellNote")}
        </p>

        <section aria-labelledby="notify-channels">
          <h3 id="notify-channels" className="mb-3 text-sm font-semibold">{t("channelsTitle")}</h3>
          <div className="grid gap-3 lg:grid-cols-3">
            <ChannelCard icon={<Smartphone size={16} />} title={t("ntfy.label")} active={Boolean(form.ntfyUrl.trim())}>
              <input id="notify-ntfy" className="field font-mono text-sm" value={form.ntfyUrl} onChange={(e) => set("ntfyUrl", e.target.value)} placeholder={t("ntfy.placeholder")} maxLength={500} spellCheck={false} aria-label={t("ntfy.label")} />
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
              <div className="mt-3 border-t border-fg/10 pt-3" data-testid="notify-urgent">
                <Toggle label={t("urgent")} hint={t("urgentHint")} checked={form.urgentCritical} onChange={(v) => set("urgentCritical", v)} />
              </div>
            </ChannelCard>
            <ChannelCard icon={<Webhook size={16} />} title={t("webhook.label")} active={Boolean(form.webhookUrl.trim())}>
              <input id="notify-webhook" className="field font-mono text-sm" value={form.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} placeholder={t("webhook.placeholder")} maxLength={1000} spellCheck={false} aria-label={t("webhook.label")} />
              {fieldErrors.webhookUrl && <p className="mt-1 text-xs text-red-400">{fieldErrors.webhookUrl}</p>}
              <p className="mt-1 text-xs text-muted">{t("webhook.hint")}</p>
            </ChannelCard>
            <ChannelCard icon={<Mail size={16} />} title={t("email.label")} active={Boolean(form.email.trim()) && smtpReady}>
              <input id="notify-email" type="email" className="field" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("email.placeholder")} maxLength={254} disabled={!smtpReady && !form.email} aria-label={t("email.label")} />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
              {!smtpReady && <p className="mt-1 text-xs text-amber-400">{t("email.noSmtp")}</p>}
            </ChannelCard>
          </div>
        </section>

        <section aria-labelledby="notify-events">
          <h3 id="notify-events" className="mb-3 text-sm font-semibold">{t("switches.title")}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {NOTIFY_GROUPS.map((g) => {
              const list = g.events.filter((e) => e !== "updated" || isAdmin);
              const allOn = list.every((e) => form.events[e]);
              return (
                <div key={g.key} className="rounded-2xl border p-4" data-testid="notify-group">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{t(`groups.${g.key}`)}</h4>
                    <button type="button" className="btn btn-ghost btn-sm ml-auto text-xs" onClick={() => setGroup(list, !allOn)}>
                      {allOn ? t("allOff") : t("allOn")}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {list.map((e) => (
                      <Toggle key={e} label={t(`switches.${e}`)} checked={form.events[e]} onChange={() => toggle(e)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            <Save size={14} /> {t("save")}
          </button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void test()}>
            <Send size={14} /> {busy ? t("testing") : t("test")}
          </button>
        </div>

        {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
        {results && results.length === 0 && <p role="status" className="text-sm text-emerald-400">{t("testInbox")}</p>}
        {results && results.length > 0 && (
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
