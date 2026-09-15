"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Check, EyeOff, Flag } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";

interface ReportGroup {
  targetType: "post" | "reply" | "message";
  targetId: string;
  count: number;
  reasons: string[];
  excerpt: string;
  hidden: boolean;
  author: { id: string; name: string };
  project: string;
  link: string;
}
interface BannedUser {
  id: string;
  name: string;
  username: string;
  since: string;
  reason: string | null;
}

/** Admin: gemeldete Beiträge prüfen und Konten für die ganze Community sperren. */
export function CommunityAdmin() {
  const t = useT("community");
  const f = useFormat();
  const [data, setData] = useState<{ off: boolean; reports: ReportGroup[]; bans: BannedUser[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api("/api/admin/community"));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const resolve = (r: ReportGroup) => api("/api/community/reports/resolve", { body: { targetType: r.targetType, targetId: r.targetId } });
  const hide = async (r: ReportGroup) => {
    const path = r.targetType === "post" ? "posts" : r.targetType === "reply" ? "replies" : "messages";
    await api(`/api/community/${path}/${r.targetId}`, { method: "PATCH", body: { hidden: true } });
    await resolve(r);
  };

  if (!data) return <FormError message={error} />;
  if (data.off) return <p className="text-xs text-muted">{t("admin.off")}</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">{t("admin.reports")}</p>
        {data.reports.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.noReports")}</p>
        ) : (
          <ul className="space-y-2" data-testid="admin-reports">
            {data.reports.map((r) => (
              <li key={`${r.targetType}:${r.targetId}`} className="rounded-xl border bg-bg/25 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <Flag size={12} /> {t("admin.reportedBy", { n: r.count })}
                  </span>
                  <span>{t("admin.in", { project: r.project || t("chat.lobby") })}</span>
                  {r.targetType === "message" && <span>· {t("chat.message")}</span>}
                  <span>· {r.author.name}</span>
                  {r.hidden && <span className="text-amber-400">· {t("hiddenBadge")}</span>}
                </p>
                <p className="mt-1 break-words">{r.excerpt}</p>
                <p className="mt-1 text-xs text-muted">{r.reasons.join(" · ")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link href={r.link} className="btn btn-sm">{t("admin.open")}</Link>
                  {!r.hidden && (
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => hide(r))}>
                      <EyeOff size={13} /> {t("actions.hide")}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => resolve(r))}>
                    <Check size={13} /> {t("actions.resolve")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm hover:!text-red-400"
                    disabled={busy}
                    onClick={() => window.confirm(t("admin.confirmBan", { name: r.author.name })) && void run(() => api("/api/admin/community/bans", { body: { userId: r.author.id } }))}
                  >
                    <Ban size={13} /> {t("admin.banAuthor")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t("admin.bans")}</p>
        {data.bans.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.noBans")}</p>
        ) : (
          <ul className="space-y-1.5" data-testid="admin-bans">
            {data.bans.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/25 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {b.name} <span className="text-muted">@{b.username}</span>
                </span>
                <span className="text-xs text-muted" suppressHydrationWarning>{t("admin.since", { date: f.date(b.since) })}</span>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => api("/api/admin/community/bans", { method: "DELETE", body: { userId: b.id } }))}>
                  {t("actions.unban")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormError message={error} />
    </div>
  );
}
