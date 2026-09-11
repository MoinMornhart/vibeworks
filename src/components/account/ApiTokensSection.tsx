"use client";

import { useState } from "react";
import { Bot, Check, Copy, KeyRound, Plus } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import type { ApiTokenItem } from "@/lib/mcp/token";
import { AccountSection } from "./AccountManager";

export function ApiTokensSection({ initial, appUrl }: { initial: ApiTokenItem[]; appUrl: string }) {
  const t = useT("mcp");
  const f = useFormat();
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = `${appUrl}/api/mcp`;
  const command = (token: string) => `claude mcp add --scope user --transport http vibeworks ${endpoint} --header "Authorization: Bearer ${token}"`;

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      /* Zwischenablage gesperrt – der Text steht ja da */
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; item: ApiTokenItem }>("/api/account/api-tokens", { method: "POST", body: { name } });
      setItems((list) => [...list, res.item]);
      setFresh({ token: res.token, name: res.item.name });
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/account/api-tokens/${id}`, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== id));
      setConfirming(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const CopyButton = ({ value, id, label }: { value: string; id: string; label?: string }) => (
    <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy(value, id)}>
      {copied === id ? <Check size={14} /> : <Copy size={14} />} {copied === id ? t("copied") : (label ?? t("copy"))}
    </button>
  );

  return (
    <AccountSection icon={<Bot size={18} />} title={t("section.title")} description={t("section.description")}>
      <p className="mb-4 text-sm text-muted">{t("can")}</p>

      {fresh && (
        <div className="mb-4 space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4" role="status">
          <p className="font-semibold text-emerald-400">{t("fresh.title", { name: fresh.name })}</p>
          <p className="text-sm">{t("fresh.once")}</p>
          <div className="flex flex-wrap items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border bg-black/30 p-3 font-mono text-xs" data-testid="mcp-command">
              {command(fresh.token)}
            </code>
            <CopyButton value={command(fresh.token)} id="command" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-muted" data-testid="mcp-token">{fresh.token}</code>
            <CopyButton value={fresh.token} id="token" label={t("fresh.key")} />
          </div>
          <p className="text-xs text-muted">{t("fresh.tryIt")}</p>
          <p className="text-xs text-muted">{t("fresh.other", { url: endpoint })}</p>
          <button type="button" className="btn btn-sm" onClick={() => setFresh(null)}>{t("fresh.done")}</button>
        </div>
      )}

      {items.length ? (
        <ul className="mb-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <KeyRound size={16} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted" suppressHydrationWarning>
                  <span className="font-mono">{item.hint}</span> · {item.lastUsedAt ? t("lastUsed", { ago: f.ago(item.lastUsedAt) }) : t("neverUsed")} · {t("created", { ago: f.ago(item.createdAt) })}
                </p>
              </div>
              {confirming === item.id ? (
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm text-red-400" disabled={busy} onClick={() => void revoke(item.id)}>{t("revokeConfirm")}</button>
                  <button type="button" className="btn btn-sm" onClick={() => setConfirming(null)}>{t("cancel")}</button>
                </div>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(item.id)}>{t("revoke")}</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted">{t("empty")}</p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="api-token-name">{t("name")}</label>
          <input id="api-token-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} maxLength={60} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
          <Plus size={14} /> {busy ? t("creating") : t("create")}
        </button>
      </form>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </AccountSection>
  );
}
