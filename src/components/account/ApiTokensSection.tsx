"use client";

import { useState } from "react";
import { Bot, Check, CircleAlert, Copy, History, KeyRound, LifeBuoy, Plus, ScrollText, ShieldCheck } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import type { ApiTokenItem } from "@/lib/mcp/token";
import { keyShortId } from "@/lib/taskInfoLogic";
import { installCommands } from "@/lib/mcp/installer";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountManager";
import { KeySettings } from "./KeySettings";

/** Programmname aus dem User-Agent, z. B. „claude-cli/2.1.0“. */
const shortAgent = (ua: string | null) => (ua ? ua.split(/[\s(]/)[0].slice(0, 40) : "?");

interface CallItem {
  id: string;
  tool: string;
  ok: boolean;
  error: string | null;
  ms: number;
  token: string;
  at: string;
}

export function ApiTokensSection({
  initial,
  appUrl,
  rules,
  rulesVersion,
  sessionIdleHours,
  sessionTtlDays,
}: {
  initial: ApiTokenItem[];
  appUrl: string;
  rules: string;
  /** Aktuelle Fassung der Regeln – ältere Bestätigungen gelten als veraltet (#79) */
  rulesVersion: string;
  sessionIdleHours: number;
  sessionTtlDays: number;
}) {
  const t = useT("mcp");
  const f = useFormat();
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallItem[] | null>(null);

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

  // Protokoll erst beim Aufklappen laden
  function loadCalls() {
    api<{ calls: CallItem[] }>("/api/account/mcp-calls")
      .then((r) => setCalls(r.calls))
      .catch((err) => setError(errorMessage(err)));
  }

  const CopyButton = ({ value, id, label }: { value: string; id: string; label?: string }) => (
    <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy(value, id)}>
      {copied === id ? <Check size={14} /> : <Copy size={14} />} {copied === id ? t("copied") : (label ?? t("copy"))}
    </button>
  );

  return (
    <AccountSection id="mcp" icon={<Bot size={18} />} title={t("section.title")} description={t("section.description")}>
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
          <p className="text-sm">{t("fresh.oneLiner")}</p>
          {(["sh", "ps1"] as const).map((kind) => {
            const line = installCommands(appUrl, fresh.token)[kind];
            return (
              <div key={kind} className="flex flex-wrap items-start gap-2">
                <span className="w-full text-xs text-muted">{t(`fresh.${kind}`)}</span>
                <code className="min-w-0 flex-1 break-all rounded-lg border bg-black/30 p-3 font-mono text-xs" data-testid={`mcp-install-${kind}`}>
                  {line}
                </code>
                <CopyButton value={line} id={`install-${kind}`} />
              </div>
            );
          })}
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
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" data-testid="api-token">
              <KeyRound size={16} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{item.name}</span>
                  <span className="rounded bg-fg/10 px-1 font-mono text-[10px] text-muted" title={t("keyIdHint")} data-testid="api-token-id">
                    {t("keyId", { id: keyShortId(item.id) })}
                  </span>
                  {(() => {
                    const current = Boolean(item.rulesAckAt) && item.rulesVersion === rulesVersion;
                    const outdated = Boolean(item.rulesAckAt) && !current;
                    return (
                      <span
                        className={cn("chip !py-0.5 text-[11px]", current ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400")}
                        title={current && item.rulesAckAt ? t("rules.ackedAt", { ago: f.ago(item.rulesAckAt) }) : outdated ? t("rules.outdatedHint") : t("rules.pendingHint")}
                        data-testid="api-token-rules"
                        suppressHydrationWarning
                      >
                        {current ? <ShieldCheck size={11} /> : <CircleAlert size={11} />} {current ? t("rules.acked") : outdated ? t("rules.outdated") : t("rules.pending")}
                      </span>
                    );
                  })()}
                </p>
                <p className="text-xs text-muted" suppressHydrationWarning>
                  <span className="font-mono">{item.hint}</span> · {item.lastUsedAt ? t("lastUsed", { ago: f.ago(item.lastUsedAt) }) : t("neverUsed")} · {t("created", { ago: f.ago(item.createdAt) })}
                </p>
                {item.lastUsedIp && (
                  <p className="text-xs text-muted" title={item.lastUsedUserAgent ?? undefined} data-testid="api-token-last-from">
                    {t("lastFrom", { ip: item.lastUsedIp, agent: shortAgent(item.lastUsedUserAgent) })}
                  </p>
                )}
                {item.clientName && (
                  <p className="text-xs text-muted">
                    {t("client", { name: [item.clientName, item.clientVersion].filter(Boolean).join(" "), protocol: item.clientProtocol ?? "?" })}
                  </p>
                )}
              </div>
              <KeySettings item={item} onSaved={(next) => setItems((list) => list.map((x) => (x.id === next.id ? next : x)))} />
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

      <div className="mt-5 rounded-2xl border px-4 py-3 text-xs text-muted" data-testid="key-lifecycle">
        <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-fg">
          <LifeBuoy size={14} className="text-accent-ink" /> {t("lifecycle.title")}
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t("lifecycle.keys")}</li>
          <li>{t("lifecycle.sessions", { hours: sessionIdleHours, days: sessionTtlDays })}</li>
          <li>{t("lifecycle.codes")}</li>
          <li>{t("lifecycle.update")}</li>
        </ul>
      </div>

      <details className="mt-3 rounded-2xl border px-4 py-3" data-testid="agent-rules">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <ScrollText size={14} className="text-accent-ink" /> {t("rules.title")}
        </summary>
        <p className="mt-2 text-xs text-muted">{t("rules.hint")}</p>
        <div className="mt-3 flex justify-end">
          <CopyButton value={rules} id="rules" />
        </div>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-black/20 p-3 font-mono text-[11px] leading-relaxed">{rules}</pre>
      </details>

      <details className="mt-3 rounded-2xl border px-4 py-3" data-testid="mcp-calls" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && loadCalls()}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <History size={14} className="text-accent-ink" /> {t("calls.title")}
        </summary>
        <p className="mt-2 text-xs text-muted">{t("calls.hint")}</p>
        {calls === null ? (
          <p className="mt-3 text-sm text-muted">{t("calls.loading")}</p>
        ) : calls.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("calls.empty")}</p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-fg/10 overflow-y-auto text-xs">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5" data-testid="mcp-call">
                <span className={cn("flex items-center gap-1", c.ok ? "text-emerald-400" : "text-red-400")}>
                  {c.ok ? <Check size={12} /> : <CircleAlert size={12} />}
                </span>
                <code className="font-mono">{c.tool}</code>
                <span className="text-muted">{c.token}</span>
                <span className="text-muted">{t("calls.ms", { n: c.ms })}</span>
                <span className="ml-auto text-muted" suppressHydrationWarning>{f.ago(c.at)}</span>
                {c.error && <span className="basis-full text-red-400/90">{c.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </AccountSection>
  );
}
