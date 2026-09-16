"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { LINK_GUARD_COOKIE, mayAutoContinue, REDIRECT_SECONDS, type LinkCheck } from "@/lib/linkCheckLogic";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Inhalt der Hinweisseite: Prüfung zeigen, bei internen Links nach 5 s weiter, sonst erst auf Klick. */
export function GoPanel({ check, guardOff }: { check: LinkCheck; guardOff: boolean }) {
  const t = useT("links");
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(guardOff);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // Nur wer aus VibeWorks kommt, darf ohne Klick weiter – sonst wäre /go eine offene Weiterleitung
    const fromApp = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    if (!mayAutoContinue(check, guardOff, fromApp)) return;
    if (check.kind === "external") {
      window.location.replace(check.url);
      return;
    }
    setAuto(true);
  }, [check, guardOff]);

  useEffect(() => {
    if (!auto) return;
    if (left <= 0) {
      window.location.replace(check.url);
      return;
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [auto, left, check.url]);

  function toggleSkip(on: boolean) {
    setSkip(on);
    try {
      document.cookie = `${LINK_GUARD_COOKIE}=${on ? "off" : "on"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      setNote(on ? t("skipOn") : t("skipOff"));
    } catch {
      /* Cookies gesperrt – dann fragt die Seite eben weiter */
    }
  }

  const back = () => (window.history.length > 1 ? window.history.back() : window.location.assign("/"));
  const risky = check.warnings.length > 0;
  const Icon = check.kind === "blocked" ? ShieldX : risky ? ShieldAlert : ShieldCheck;

  return (
    <section className="glass w-full space-y-4 p-6 sm:p-8" data-testid="go-panel">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Icon size={22} className={cn(check.kind === "blocked" ? "text-red-400" : risky ? "text-amber-300" : "text-emerald-400")} /> {t("title")}
      </h1>

      {check.kind === "blocked" && <p className="text-sm text-red-400">{t("blocked")}</p>}

      {check.kind === "internal" && (
        <>
          <p className="text-sm">{t("internal")}</p>
          <code className="block break-all rounded-lg border bg-bg/40 p-3 text-xs">{check.url}</code>
          {auto && (
            <p className="text-sm text-muted" data-testid="go-countdown">
              {t("redirect", { s: left })}{" "}
              <button type="button" className="text-accent-ink hover:underline" onClick={() => setAuto(false)}>
                {t("stay")}
              </button>
            </p>
          )}
        </>
      )}

      {check.kind === "external" && (
        <>
          <p className="text-sm">{t("external")}</p>
          <code className="block break-all rounded-lg border bg-bg/40 p-3 text-xs" data-testid="go-url">
            <b>{check.host}</b>
            <span className="text-muted">{check.url.slice(check.url.indexOf(check.host) + check.host.length)}</span>
          </code>
          {risky ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" data-testid="go-warnings">
              <p className="font-medium">{t("warningsTitle")}</p>
              <ul className="mt-1 list-disc pl-5">
                {check.warnings.map((w) => (
                  <li key={w}>{t(`warnings.${w}`)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-emerald-400" data-testid="go-safe">{t("safe")}</p>
          )}
          <p className="text-xs text-muted">{t("checked")}</p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {check.kind !== "blocked" && (
          <a href={check.url} rel="noopener noreferrer nofollow" className={cn("btn btn-sm", risky ? "" : "btn-primary")} data-testid="go-open">
            <ExternalLink size={14} /> {t("open")}
          </a>
        )}
        <button type="button" className="btn btn-sm" onClick={back}>
          <ArrowLeft size={14} /> {t("back")}
        </button>
      </div>

      {check.kind === "external" && (
        <label className="flex cursor-pointer items-start gap-2 border-t border-fg/10 pt-3 text-xs">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--vw-accent)]" checked={skip} onChange={(e) => toggleSkip(e.target.checked)} data-testid="go-skip" />
          <span>
            <span className="font-medium">{t("skip")}</span>
            <span className="block text-muted">{t("skipHint")}</span>
          </span>
        </label>
      )}
      {note && <p role="status" className="text-xs text-muted">{note}</p>}
    </section>
  );
}
