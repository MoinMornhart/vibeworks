"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectRole } from "@prisma/client";
import { Check, Copy, Globe, Link2Off, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import type { ShareState } from "@/lib/share";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ROLES: ProjectRole[] = ["VIEWER", "EDITOR"];

function RoleSelect({ value, onChange, disabled, label }: { value: ProjectRole; onChange: (r: ProjectRole) => void; disabled?: boolean; label: string }) {
  const t = useT("share");
  return (
    <select className="field !w-auto !py-1.5 text-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as ProjectRole)} aria-label={label}>
      {ROLES.map((r) => (
        <option key={r} value={r}>{t(`role.${r}`)}</option>
      ))}
    </select>
  );
}

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ShareDialog({
  projectId,
  open,
  onClose,
  onPendingChange,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onPendingChange?: (count: number) => void;
}) {
  const t = useT("share");
  const tc = useT("common");
  const f = useFormat();
  const [share, setShare] = useState<ShareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<ProjectRole>("VIEWER");
  const [decisionRole, setDecisionRole] = useState<Record<string, ProjectRole>>({});
  const linkRef = useRef<HTMLInputElement>(null);
  const onPendingRef = useRef(onPendingChange);
  onPendingRef.current = onPendingChange;

  const apply = (s: ShareState) => {
    setShare(s);
    onPendingRef.current?.(s.requests.length);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCopied(false);
    api<{ share: ShareState }>(`/api/projects/${projectId}/share`)
      .then((r) => apply(r.share))
      .catch((e) => setError(errorMessage(e)));
  }, [open, projectId]);

  async function run(fn: () => Promise<{ share: ShareState }>) {
    setBusy(true);
    setError(null);
    try {
      apply((await fn()).share);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const setLink = (link: "on" | "off" | "renew") => run(() => api(`/api/projects/${projectId}/share`, { method: "PUT", body: { link } }));
  const setMemberRole = (userId: string, r: ProjectRole) => run(() => api(`/api/projects/${projectId}/members/${userId}`, { method: "PATCH", body: { role: r } }));
  const removeMember = (userId: string, name: string) => {
    if (window.confirm(t("dialog.confirmRemove", { name }))) void run(() => api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" }));
  };
  const decide = (id: string, decision: "approve" | "deny", r?: ProjectRole) =>
    run(() => api(`/api/projects/${projectId}/requests/${id}`, { method: "PATCH", body: { decision, role: r } }));

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    if (await run(() => api(`/api/projects/${projectId}/members`, { body: { username: username.trim(), role } }))) setUsername("");
  }

  const url = share?.shareToken && typeof window !== "undefined" ? `${window.location.origin}/s/${share.shareToken}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Ohne HTTPS gibt es keine Zwischenablage-API – dann markieren und klassisch kopieren.
      linkRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("dialog.title")} size="lg">
      <div className="space-y-6">
        <section aria-labelledby="share-link">
          <h3 id="share-link" className="mb-1 flex items-center gap-2 font-semibold"><Globe size={16} className="text-accent-ink" /> {t("dialog.linkTitle")}</h3>
          <p className="mb-3 text-sm text-muted">{t("dialog.linkText")}</p>
          {share?.shareToken ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input ref={linkRef} readOnly value={url} className="field min-w-0 flex-1 font-mono text-xs" aria-label={t("dialog.linkLabel")} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => void copy()}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tc("copied") : tc("copy")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void setLink("renew")} title={t("dialog.renewTitle")}>
                  <RefreshCw size={14} /> {t("dialog.renew")}
                </button>
                <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy} onClick={() => void setLink("off")}>
                  <Link2Off size={14} /> {t("dialog.disable")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !share} onClick={() => void setLink("on")}>
              <Globe size={14} /> {t("dialog.create")}
            </button>
          )}
        </section>

        {share && share.requests.length > 0 && (
          <section aria-labelledby="share-requests" className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <h3 id="share-requests" className="mb-3 font-semibold">{t("dialog.requests")} <span className="text-sm font-normal text-muted">{share.requests.length}</span></h3>
            <ul className="space-y-3">
              {share.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-3">
                  <Initial name={r.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name} <span className="font-normal text-muted">@{r.username}</span></p>
                    <p className="text-xs text-muted" suppressHydrationWarning>
                      {t(`dialog.wants.${r.role}`)} · {f.ago(r.createdAt)}
                    </p>
                    {r.message && <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-bg/40 px-2 py-1 text-sm">{r.message}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleSelect label={t("dialog.roleFor", { name: r.name })} value={decisionRole[r.id] ?? r.role} onChange={(v) => setDecisionRole((d) => ({ ...d, [r.id]: v }))} disabled={busy} />
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide(r.id, "approve", decisionRole[r.id] ?? r.role)}>
                      <Check size={14} /> {t("dialog.approve")}
                    </button>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void decide(r.id, "deny")}>{t("dialog.deny")}</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="share-members">
          <h3 id="share-members" className="mb-3 flex items-center gap-2 font-semibold"><Users size={16} className="text-accent-ink" /> {t("dialog.members")}</h3>
          {share && share.members.length === 0 && <p className="mb-3 text-sm text-muted">{t("dialog.noMembers")}</p>}
          {share && share.members.length > 0 && (
            <ul className="mb-4 divide-y divide-fg/10 rounded-2xl border">
              {share.members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <Initial name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted">@{m.username}</p>
                  </div>
                  <RoleSelect label={t("dialog.roleOf", { name: m.name })} value={m.role} onChange={(v) => void setMemberRole(m.userId, v)} disabled={busy} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" disabled={busy} onClick={() => removeMember(m.userId, m.name)} aria-label={t("dialog.removeName", { name: m.name })} title={tc("remove")}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addMember} className="flex flex-wrap gap-2">
            <input
              className="field min-w-0 flex-1"
              placeholder={t("dialog.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={64}
              aria-label={t("dialog.usernameLabel")}
              autoComplete="off"
            />
            <RoleSelect label={t("dialog.role")} value={role} onChange={setRole} disabled={busy} />
            <button type="submit" className="btn btn-sm" disabled={busy || !username.trim()}>
              <UserPlus size={14} /> {tc("add")}
            </button>
          </form>
          <p className={cn("mt-2 text-xs text-muted")}>
            <b>{t("role.VIEWER")}</b>: {t("dialog.viewerHelp")} · <b>{t("role.EDITOR")}</b>: {t("dialog.editorHelp")}
          </p>
        </section>

        <FormError message={error} />
      </div>
    </Modal>
  );
}
