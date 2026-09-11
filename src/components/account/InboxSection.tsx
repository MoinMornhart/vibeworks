"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Inbox, RefreshCw, Save } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import type { InboxInfo } from "@/lib/inboxServer";
import { AccountSection } from "./AccountManager";

/** Ideen-Eingang: Einwurf-Adresse, ntfy-Thema, „Teilen“ vom Handy. */
export function InboxSection({ initial }: { initial: InboxInfo }) {
  const t = useT("inbox");
  const [info, setInfo] = useState(initial);
  const [ntfyUrl, setNtfyUrl] = useState(initial.ntfyUrl);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const curl = `curl -d "Meine Idee" ${info.webhookUrl}`;

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      /* Zwischenablage gesperrt */
    }
  }

  async function save(regenerate = false) {
    if (regenerate && !window.confirm(t("settings.regenerateConfirm"))) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    setFieldError(null);
    try {
      const res = await api<{ inbox: InboxInfo }>("/api/account/inbox", { method: "PUT", body: { ntfyUrl, regenerate } });
      setInfo(res.inbox);
      setNotice(regenerate ? t("settings.regenerated") : t("settings.saved"));
    } catch (err) {
      if (err instanceof ApiClientError) setFieldError(err.fieldErrors.ntfyUrl ?? null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="inbox">
      <AccountSection icon={<Inbox size={18} />} title={t("settings.title")} description={t("settings.description")}>
        <div className="space-y-5">
          <div>
            <p className="label">{t("settings.webhook")}</p>
            <div className="flex flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border bg-black/30 p-2.5 font-mono text-xs" data-testid="inbox-webhook">{info.webhookUrl}</code>
              <button type="button" className="btn btn-sm" onClick={() => void copy(info.webhookUrl, "url")}>
                {copied === "url" ? <Check size={14} /> : <Copy size={14} />} {copied === "url" ? t("settings.copied") : t("settings.copy")}
              </button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save(true)}><RefreshCw size={14} /> {t("settings.regenerate")}</button>
            </div>
            <p className="mt-1 text-xs text-muted">{t("settings.webhookHint")}</p>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-muted">{curl}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(curl, "curl")}>
                {copied === "curl" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="inbox-ntfy">{t("settings.ntfy")}</label>
            <div className="flex flex-wrap gap-2">
              <input id="inbox-ntfy" className="field min-w-0 flex-1 font-mono text-sm" value={ntfyUrl} onChange={(e) => setNtfyUrl(e.target.value)} placeholder="https://ntfy.sh/meine-geheimen-ideen" spellCheck={false} />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}><Save size={14} /> {t("settings.save")}</button>
            </div>
            {fieldError && <p className="mt-1 text-xs text-red-400">{fieldError}</p>}
            <p className="mt-1 text-xs text-muted">{t("settings.ntfyHint")}</p>
          </div>

          <p className="text-xs text-muted">{t("settings.shareHint")}</p>
          {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
          <FormError message={error} />
          <Link href="/inbox" className="btn btn-sm">{t("settings.openInbox")}</Link>
        </div>
      </AccountSection>
    </div>
  );
}
