"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, EyeOff, Eye, Rocket, X } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import type { OnboardingState } from "@/lib/onboarding";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

/** Im Konto: geschlossene Liste wieder aufs Dashboard holen. */
export function OnboardingRestore() {
  const t = useT("onboarding");
  const [busy, setBusy] = useState(false);
  async function restore() {
    setBusy(true);
    try {
      await api("/api/account/onboarding", { method: "PATCH", body: { dismissed: false } });
      window.location.assign("/");
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(false);
    }
  }
  return (
    <button type="button" className="btn btn-sm self-start" disabled={busy} onClick={() => void restore()} data-testid="onboarding-restore">
      <Rocket size={13} /> {t("restore")}
    </button>
  );
}

/** Erste Schritte (#100): was noch offen ist – Erledigtes lässt sich auf einmal ausblenden. */
export function OnboardingCard({ initial }: { initial: OnboardingState }) {
  const t = useT("onboarding");
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const doneCount = state.steps.filter((s) => s.done).length;
  const visible = state.hideDone ? state.steps.filter((s) => !s.done) : state.steps;

  async function save(body: { hideDone?: boolean; dismissed?: boolean }) {
    setBusy(true);
    try {
      setState((await api<{ onboarding: OnboardingState }>("/api/account/onboarding", { method: "PATCH", body })).onboarding);
      if (body.dismissed) toast(t("dismissed"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (state.dismissed) return null;
  return (
    <section id="erste-schritte" className="glass fade-in mb-6 scroll-mt-24 px-5 py-4" aria-labelledby="onboarding-heading" data-testid="onboarding">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="onboarding-heading" className="flex items-center gap-2 font-semibold">
          <Rocket size={16} className="text-accent-ink" /> {t("title")}
        </h2>
        <span className="rounded-full bg-fg/10 px-2 text-xs tabular-nums text-muted" data-testid="onboarding-count">
          {t("progress", { done: doneCount, total: state.steps.length })}
        </span>
        <div className="ml-auto flex gap-1">
          {doneCount > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void save({ hideDone: !state.hideDone })} data-testid="onboarding-hide-done">
              {state.hideDone ? <Eye size={13} /> : <EyeOff size={13} />} {state.hideDone ? t("showDone") : t("hideDone", { n: doneCount })}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={busy} onClick={() => void save({ dismissed: true })} aria-label={t("dismiss")} title={t("dismiss")} data-testid="onboarding-dismiss">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((doneCount / state.steps.length) * 100)}%` }} />
      </div>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-400">{t("allDone")}</p>
      ) : (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {visible.map((s) => (
            <li key={s.key} data-testid={`onboarding-${s.key}`} data-done={s.done}>
              <Link href={s.href} className={cn("flex items-start gap-2 rounded-lg px-2 py-1 text-sm hover:bg-fg/5", s.done && "text-muted")}>
                {s.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted" />}
                <span>
                  <span className={cn("font-medium", s.done && "line-through")}>{t(`steps.${s.key}.title`)}</span>
                  {!s.done && <span className="block text-xs text-muted">{t(`steps.${s.key}.hint`)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
