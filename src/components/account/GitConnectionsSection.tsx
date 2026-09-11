"use client";

import { useState } from "react";
import { CheckCircle2, GitBranch, Plus, Save, Trash2, X } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { EMPTY_GIT_CONNECTION, GitProviderFields, type GitConnectionForm } from "@/components/git/GitProviderFields";
import { PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { AccountSection } from "./AccountManager";

export interface GitConnectionItem {
  id: string;
  provider: GitProvider;
  host: string;
  baseUrl: string;
  hint: string;
  login: string | null;
}

export function GitConnectionsSection({ initial }: { initial: GitConnectionItem[] }) {
  const t = useT("account");
  const tc = useT("common");
  const [list, setList] = useState(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [form, setForm] = useState<GitConnectionForm>(EMPTY_GIT_CONNECTION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | undefined>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.token.trim()) return;
    setBusy(true);
    setError(null);
    setTokenError(undefined);
    try {
      const res = await api<{ connections: GitConnectionItem[] }>("/api/account/git-credentials", {
        body: { provider: form.provider, server: form.server, token: form.token.trim() },
      });
      setList(res.connections);
      setForm(EMPTY_GIT_CONNECTION);
      setAdding(false);
    } catch (err) {
      const field = err instanceof ApiClientError ? err.fieldErrors.token : undefined;
      if (field) setTokenError(field);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: GitConnectionItem) {
    if (!window.confirm(t("git.confirmRemove", { host: c.host }))) return;
    setError(null);
    try {
      const res = await api<{ connections: GitConnectionItem[] }>(`/api/account/git-credentials/${c.id}`, { method: "DELETE" });
      setList(res.connections);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div id="git-zugang" className="scroll-mt-24">
      <AccountSection icon={<GitBranch size={18} />} title={t("git.title")} description={t("git.description")}>
        {list.length > 0 && (
          <ul className="mb-4 space-y-2">
            {list.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {PROVIDER_LABEL[c.provider]} · {c.host}
                    {c.login && <> {t("git.as")} <span className="text-accent-ink">@{c.login}</span></>}
                  </p>
                  <p className="font-mono text-xs text-muted">{c.hint}</p>
                </div>
                <button type="button" className="btn btn-sm hover:!text-red-400" onClick={() => void remove(c)} aria-label={t("git.removeLabel", { host: c.host })}>
                  <Trash2 size={14} /> {tc("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form onSubmit={save} className="space-y-3 rounded-2xl border bg-bg/30 p-4">
            <GitProviderFields
              value={form}
              onChange={(v) => {
                setForm(v);
                setTokenError(undefined); // alte Meldung passt nach einer Änderung nicht mehr
              }}
              error={tokenError}
              idPrefix="account-git"
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !form.token.trim()}>
                <Save size={14} /> {busy ? t("git.checking") : t("git.connect")}
              </button>
              {list.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>
                  <X size={14} /> {tc("cancel")}
                </button>
              )}
            </div>
            <p className="text-xs text-muted">{t("git.tokenHint")}</p>
          </form>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> {t("git.add")}
          </button>
        )}
        <FormError message={error} />
      </AccountSection>
    </div>
  );
}
