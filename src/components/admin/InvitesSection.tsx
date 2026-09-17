"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Ticket, Trash2 } from "lucide-react";
import type { InviteItem } from "@/lib/invites";
import { INVITE_DAYS, type InviteDays } from "@/lib/inviteLogic";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/client/dialogs";

const STATUS_TONE: Record<InviteItem["status"], string> = {
  open: "bg-emerald-500/15 text-emerald-400",
  used: "bg-fg/10 text-muted",
  expired: "bg-amber-500/15 text-amber-400",
};

/** Einladungslinks erzeugen, anzeigen (nur einmal) und zurückziehen. */
export function InvitesSection({ multi }: { multi: boolean }) {
  const t = useT("admin");
  const f = useFormat();
  const [invites, setInvites] = useState<InviteItem[] | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState<InviteDays>(7);
  const [link, setLink] = useState<{ url: string; until: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!multi) return;
    api<{ invites: InviteItem[] }>("/api/admin/invites")
      .then((r) => setInvites(r.invites))
      .catch((e) => setError(errorMessage(e)));
  }, [multi]);

  if (!multi) return <p className="text-xs text-muted">{t("invites.multiOnly")}</p>;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await api<{ invites: InviteItem[]; link: string }>("/api/admin/invites", { body: { note: note.trim() || null, days } });
      setInvites(res.invites);
      setLink({ url: res.link, until: res.invites[0]?.expiresAt ?? "" });
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!(await confirmDialog(t("invites.confirmRevoke"), { danger: true }))) return;
    setBusy(true);
    setError(null);
    try {
      setInvites((await api<{ invites: InviteItem[] }>(`/api/admin/invites/${id}`, { method: "DELETE" })).invites);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      const area = document.createElement("textarea");
      area.value = link.url;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="invite-note">{t("invites.note")}</label>
          <input id="invite-note" className="field" maxLength={100} placeholder={t("invites.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="invite-days">{t("invites.days")}</label>
          <select id="invite-days" className="field" value={days} onChange={(e) => setDays(Number(e.target.value) as InviteDays)}>
            {INVITE_DAYS.map((d) => (
              <option key={d} value={d}>{t("invites.daysOption", { n: d })}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy}>
          <Ticket size={14} /> {busy ? t("invites.creating") : t("invites.create")}
        </button>
      </form>

      {link && (
        <div className="space-y-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3" data-testid="invite-link">
          <span className="label">{t("invites.link")}</span>
          <div className="flex gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className="field min-w-0 flex-1 font-mono text-xs" aria-label={t("invites.link")} />
            <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("invites.copied") : t("invites.copy")}
            </button>
          </div>
          <p className="text-xs text-muted" suppressHydrationWarning>{t("invites.linkHint", { date: link.until ? f.date(link.until) : "–" })}</p>
        </div>
      )}

      {invites && invites.length === 0 && <p className="text-sm text-muted">{t("invites.empty")}</p>}
      {invites && invites.length > 0 && (
        <ul className="space-y-1.5" data-testid="invite-list">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-bg/25 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted">{i.hint}</span>
              <span className="min-w-0 flex-1 truncate">{i.note || "–"}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS_TONE[i.status])}>{t(`invites.status.${i.status}`)}</span>
              <span className="text-xs text-muted" suppressHydrationWarning>
                {i.status === "open"
                  ? t("invites.validUntil", { date: f.date(i.expiresAt) })
                  : i.status === "used"
                    ? i.usedBy
                      ? t("invites.usedBy", { name: i.usedBy, ago: f.ago(i.usedAt!) })
                      : t("invites.usedByUnknown", { ago: f.ago(i.usedAt!) })
                    : t("invites.expiredAt", { ago: f.ago(i.expiresAt) })}
              </span>
              {i.status === "open" && (
                <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy} onClick={() => void revoke(i.id)} title={t("invites.revoke")} aria-label={t("invites.revoke")}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
    </div>
  );
}
