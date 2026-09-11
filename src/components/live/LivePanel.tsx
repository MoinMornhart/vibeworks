"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import type { LiveStats } from "@/lib/monitor/stats";
import { addDaysKey } from "@/lib/weeks";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useLocale, useMsg, useT } from "@/lib/i18n/client";
import { INTL_LOCALE } from "@/lib/i18n/config";

export interface LiveInfo {
  url: string;
  state: "up" | "down" | null;
  ms: number | null;
  since: string | null;
  checkedAt: string | null;
  error: string | null;
  sslExpiresAt: string | null;
}

const DAY = 86_400_000;

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${tone}`} suppressHydrationWarning>{value}</dd>
    </div>
  );
}

/** Live-Bereich der Projektseite: Zustand, Erreichbarkeit, Zertifikat, 30-Tage-Balken. */
export function LivePanel({ projectId, info, stats, today, canCheck }: { projectId: string; info: LiveInfo; stats: LiveStats; today: string; canCheck: boolean }) {
  const t = useT("live");
  const f = useFormat();
  const msg = useMsg();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  const fmt = (v: number | null) => (v === null ? "–" : `${pct.format(v * 100)} %`);
  const byDay = new Map(stats.days.map((d) => [d.day, d]));
  const days = Array.from({ length: 30 }, (_, i) => addDaysKey(today, i - 29));
  const host = info.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  async function checkNow() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/live`, { body: {} });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const dot = info.state === "up" ? "bg-emerald-400" : info.state === "down" ? "animate-pulse bg-red-400" : "bg-fg/30";
  const status =
    info.state === "up" ? t("online", { ms: info.ms ?? 0 }) : info.state === "down" ? t("offline", { ago: info.since ? f.ago(info.since) : "–" }) : t("unknown");

  let ssl = t("sslUnknown");
  let sslTone = "";
  if (!info.url.startsWith("https:")) ssl = t("sslNone");
  else if (info.sslExpiresAt) {
    const left = Math.floor((Date.parse(info.sslExpiresAt) - Date.now()) / DAY);
    ssl = left < 0 ? t("sslExpired") : t("sslValid", { date: f.date(info.sslExpiresAt), n: left });
    sslTone = left < 0 ? "text-red-400" : left <= 14 ? "text-amber-400" : "";
  }

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="live-heading">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="live-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Activity size={18} className="text-accent-ink" /> {t("title")}
        </h2>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-sm text-accent-ink hover:underline">
          {host} <ExternalLink size={12} />
        </a>
        {canCheck && (
          <button className="btn btn-sm ml-auto" disabled={busy} onClick={() => void checkNow()}>
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? t("checking") : t("checkNow")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <p className="flex items-center gap-2 text-base font-semibold" data-testid="live-status" suppressHydrationWarning>
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {status}
        </p>
        {info.state === "down" && info.error && <p className="text-sm text-red-400">{t("error", { error: msg(info.error) })}</p>}
        {info.checkedAt && <p className="text-xs text-muted" suppressHydrationWarning>{t("checked", { ago: f.ago(info.checkedAt) })}</p>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label={`${t("uptime")} · ${t("h24")}`} value={fmt(stats.uptime.h24)} />
        <Stat label={`${t("uptime")} · ${t("d7")}`} value={fmt(stats.uptime.d7)} />
        <Stat label={`${t("uptime")} · ${t("d30")}`} value={fmt(stats.uptime.d30)} />
        <Stat label={t("avgMs")} value={stats.avgMs === null ? "–" : `${Math.round(stats.avgMs)} ms`} />
        <Stat label={t("ssl")} value={ssl} tone={sslTone} />
      </dl>

      <div className="mt-5">
        <p className="mb-1.5 text-xs text-muted">{t("bar")}</p>
        <div className="flex h-8 gap-[3px]" role="img" aria-label={t("barLabel", { pct: fmt(stats.uptime.d30) })}>
          {days.map((day) => {
            const d = byDay.get(day);
            const ratio = d && d.total ? d.ok / d.total : null;
            const tone = ratio === null ? "bg-fg/10" : ratio >= 0.995 ? "bg-emerald-400" : ratio >= 0.95 ? "bg-amber-400" : "bg-red-400";
            const label = d ? t("dayTitle", { day: f.date(day), pct: fmt(ratio), ms: d.ms === null ? "–" : Math.round(d.ms) }) : t("dayEmpty", { day: f.date(day) });
            return <span key={day} title={label} className={`flex-1 rounded-sm ${tone}`} />;
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{t("hint")}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
