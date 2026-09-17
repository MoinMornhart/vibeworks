"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Save, Send, Trash2 } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/Toaster";
import { AccountSection } from "@/components/account/AccountManager";
import { CopyPrompt } from "@/components/projects/WorkflowPanel";

interface DiscordView {
  appId: string;
  publicKey: string;
  hasBotToken: boolean;
  hasClientSecret: boolean;
  commandsAt: string | null;
  ready: boolean;
  interactionsUrl: string;
  redirectUri: string;
  links: number;
}

function DiscordIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.5-5.1-.9-9.6-3.6-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}
export { DiscordIcon };

/** Discord-Anwendung der Instanz (#105) – lädt sich selbst. */
export function DiscordAdminSection() {
  const t = useT("discord");
  const f = useFormat();
  const [view, setView] = useState<DiscordView | null>(null);
  const [form, setForm] = useState({ appId: "", publicKey: "", botToken: "", clientSecret: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (v: DiscordView) => {
    setView(v);
    setForm({ appId: v.appId, publicKey: v.publicKey, botToken: "", clientSecret: "" });
  };

  useEffect(() => {
    api<{ discord: DiscordView }>("/api/admin/discord")
      .then((r) => apply(r.discord))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      apply((await api<{ discord: DiscordView }>("/api/admin/discord", { method: "PUT", body: { ...form, botToken: form.botToken || undefined, clientSecret: form.clientSecret || undefined } })).discord);
      toast(t("admin.saved"));
    });
  const register = () =>
    run(async () => {
      const res = await api<{ registered: number; discord: DiscordView }>("/api/admin/discord", { body: {} });
      apply(res.discord);
      toast(t("admin.registered", { n: res.registered }));
    });
  const remove = () => {
    if (!window.confirm(t("admin.confirmRemove"))) return;
    void run(async () => apply((await api<{ discord: DiscordView }>("/api/admin/discord", { method: "DELETE" })).discord));
  };
  const set = (key: keyof typeof form, value: string) => setForm((x) => ({ ...x, [key]: value }));

  return (
    <AccountSection id="discord-admin" icon={<DiscordIcon />} title={t("admin.title")} description={t("admin.description")}>
      {view && (
        <form
          className="space-y-4"
          data-testid="discord-admin"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className={view.ready ? "flex items-center gap-2 text-sm text-emerald-400" : "text-sm text-muted"} data-testid="discord-admin-state">
            {view.ready && <CheckCircle2 size={15} />} {view.ready ? t("admin.ready") : t("admin.incomplete")}
            {view.commandsAt && <span className="text-xs text-muted" suppressHydrationWarning> · {t("admin.registeredAt", { when: f.ago(view.commandsAt) })}</span>}
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              {t("admin.step1")}{" "}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                discord.com/developers <ExternalLink size={11} />
              </a>
            </li>
            <li className="space-y-1">
              <span>{t("admin.step2")}</span>
              <CopyPrompt text={view.interactionsUrl} label={t("admin.copy")} />
            </li>
            <li className="space-y-1">
              <span>{t("admin.step3")}</span>
              <CopyPrompt text={view.redirectUri} label={t("admin.copy")} />
            </li>
            <li>{t("admin.step4")}</li>
            <li>{t("admin.step5")}</li>
          </ol>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="discord-app">{t("admin.appId")}</label>
              <input id="discord-app" className="field font-mono" inputMode="numeric" value={form.appId} onChange={(e) => set("appId", e.target.value.replace(/\D/g, "").slice(0, 25))} />
            </div>
            <div>
              <label className="label" htmlFor="discord-key">{t("admin.publicKey")}</label>
              <input id="discord-key" className="field font-mono text-xs" value={form.publicKey} onChange={(e) => set("publicKey", e.target.value.trim())} maxLength={64} spellCheck={false} />
            </div>
            <div>
              <label className="label" htmlFor="discord-secret">{t("admin.clientSecret")}</label>
              <input id="discord-secret" type="password" autoComplete="new-password" className="field" value={form.clientSecret} onChange={(e) => set("clientSecret", e.target.value)} placeholder={view.hasClientSecret ? t("admin.keep") : ""} maxLength={200} />
            </div>
            <div>
              <label className="label" htmlFor="discord-token">{t("admin.botToken")}</label>
              <input id="discord-token" type="password" autoComplete="new-password" className="field" value={form.botToken} onChange={(e) => set("botToken", e.target.value)} placeholder={view.hasBotToken ? t("admin.keep") : ""} maxLength={200} />
            </div>
          </div>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} data-testid="discord-admin-save">
              <Save size={14} /> {t("admin.save")}
            </button>
            <button type="button" className="btn btn-sm" disabled={busy || !view.ready} onClick={() => void register()} data-testid="discord-admin-register">
              <Send size={14} /> {t("admin.register")}
            </button>
            {(view.appId || view.hasBotToken) && (
              <button type="button" className="btn btn-ghost btn-sm hover:text-red-400" disabled={busy} onClick={remove}>
                <Trash2 size={14} /> {t("admin.remove")}
              </button>
            )}
          </div>
        </form>
      )}
      {!view && <FormError message={error} />}
    </AccountSection>
  );
}
