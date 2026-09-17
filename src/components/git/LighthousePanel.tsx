"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Gauge, Link2Off, RefreshCw } from "lucide-react";
import type { LighthouseView } from "@/lib/git/lighthouse";
import { LH_CATEGORIES, LH_DROP } from "@/lib/git/lighthouseLogic";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

type Action = "run" | "refresh" | "enable" | "disable";
/** Solange ein Lauf aussteht, so oft nachsehen (nur bei sichtbarem Tab). */
const POLL_MS = 60_000;

const scoreTone = (n: number) => (n >= 90 ? "text-emerald-400 border-emerald-500/50" : n >= 50 ? "text-amber-400 border-amber-500/50" : "text-red-400 border-red-500/50");

function ms(v: number | undefined): string | null {
  if (v === undefined) return null;
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`;
}

/** Lighthouse-Check der Live-Seite (#82): Werte, kaputte Links, „Jetzt prüfen“ und (Besitzer) ein/aus. */
export function LighthousePanel({ projectId, canRun, canManage, hasToken }: { projectId: string; canRun: boolean; canManage: boolean; hasToken: boolean }) {
  const t = useT("lighthouse");
  const f = useFormat();
  const msg = useMsg();
  const [lh, setLh] = useState<LighthouseView | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ lighthouse: LighthouseView }>(`/api/projects/${projectId}/lighthouse`)
      .then((res) => alive && setLh(res.lighthouse))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function act(action: Action, quiet = false) {
    if (!quiet) {
      setBusy(action);
      setError(null);
    }
    try {
      const res = await api<{ lighthouse: LighthouseView; removed: boolean; warning: string | null }>(`/api/projects/${projectId}/lighthouse`, { body: { action } });
      setLh(res.lighthouse);
      if (action === "enable") toast(t("enabled"));
      if (action === "run") toast(t("started"));
      if (action === "disable") toast(res.warning ? msg(res.warning) : res.removed ? t("removed") : t("disabled"), res.warning ? "error" : undefined);
    } catch (e) {
      if (!quiet) setError(errorMessage(e));
    } finally {
      if (!quiet) setBusy(null);
    }
  }

  const pending = Boolean(lh?.enabled && (lh.status === "waiting" || lh.status === "running"));
  useEffect(() => {
    if (!pending || !canRun) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void act("refresh", true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- act ändert sich nicht wesentlich
  }, [pending, canRun]);

  const r = lh?.report ?? null;
  const hasScores = r ? Object.keys(r.scores).length > 0 : false;
  return (
    <section id="lighthouse" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="lighthouse-heading" data-testid="lighthouse">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="lighthouse-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Gauge size={18} className="text-accent-ink" /> {t("title")}
        </h2>
        {lh?.enabled && lh.status && (
          <span className="text-xs text-muted" data-testid="lighthouse-status" suppressHydrationWarning>
            {t(`status.${lh.status}`, { when: lh.runAt ? f.ago(lh.runAt) : "" })}
          </span>
        )}
        {lh?.runUrl && (
          <a href={lh.runUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
            {t("openRun")} <ExternalLink size={11} />
          </a>
        )}
        {lh && (
          <div className="ml-auto flex flex-wrap gap-2">
            {canRun && lh.enabled && (
              <button type="button" className="btn btn-sm" disabled={busy !== null || lh.status === "running" || !lh.liveUrl} onClick={() => void act("run")} data-testid="lighthouse-run">
                <RefreshCw size={14} className={cn((busy === "run" || lh.status === "running") && "animate-spin")} /> {t("run")}
              </button>
            )}
            {canManage &&
              (lh.enabled ? (
                <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy !== null} onClick={() => window.confirm(t("confirmDisable")) && void act("disable")} data-testid="lighthouse-disable">
                  {t("disable")}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null || !lh.liveUrl || !hasToken} onClick={() => void act("enable")} data-testid="lighthouse-enable">
                  {t("enable")}
                </button>
              ))}
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">{t("description")}</p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {!lh ? (
        !error && <div className="h-16 animate-pulse rounded-xl bg-fg/5" />
      ) : !lh.enabled ? (
        <div className="space-y-1 text-sm text-muted">
          <p>{t("off")}</p>
          {!lh.liveUrl && <p className="text-amber-400">{t("noLiveUrl")}</p>}
          {lh.liveUrl && !hasToken && <p className="text-amber-400">{t("noToken")}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {lh.error && <p className="text-sm text-amber-400">{msg(lh.error)}</p>}
          {r && !hasScores && <p className="text-sm text-amber-400">{r.error || t("noReport")}</p>}
          {r && hasScores && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="lighthouse-scores">
              {LH_CATEGORIES.map((c) => {
                const n = r.scores[c];
                const best = lh.baseline?.[c];
                const dropped = n !== undefined && best !== undefined && n <= best - LH_DROP;
                return (
                  <div key={c} className="flex flex-col items-center gap-1.5 rounded-2xl border bg-bg/25 p-3 text-center" data-testid="lighthouse-score" data-category={c}>
                    <span className={cn("flex size-14 items-center justify-center rounded-full border-4 text-lg font-bold tabular-nums", n === undefined ? "border-fg/10 text-muted" : scoreTone(n))}>{n ?? "–"}</span>
                    <span className="text-xs font-medium">{t(`categories.${c}`)}</span>
                    {best !== undefined && best !== n && <span className={cn("text-[11px]", dropped ? "text-red-400" : "text-muted")}>{t("best", { n: best })}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {r && hasScores && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              {(["lcp", "fcp", "tbt", "cls"] as const).map((m) => {
                const v = m === "cls" ? (r.metrics.cls !== undefined ? r.metrics.cls.toFixed(3) : null) : ms(r.metrics[m]);
                return v === null ? null : (
                  <div key={m}>
                    <dt className="text-muted">{t(`metrics.${m}`)}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {r && (
            <div data-testid="lighthouse-links">
              {!r.tools.lychee ? (
                <p className="text-xs text-muted">{t("links.notChecked")}</p>
              ) : r.brokenLinks.length === 0 ? (
                <p className="text-xs text-emerald-400">{t("links.none")}</p>
              ) : (
                <>
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-red-400">
                    <Link2Off size={14} /> {t("links.title", { n: r.brokenLinks.length })}
                  </h3>
                  <ul className="space-y-1 text-xs">
                    {r.brokenLinks.map((l) => (
                      <li key={l.url} className="flex flex-wrap items-center gap-2">
                        <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 break-all text-accent-ink hover:underline">
                          {l.url}
                        </a>
                        <span className="text-muted">{l.status ?? l.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
