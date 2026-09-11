"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Square, Timer } from "lucide-react";
import { startTimer, stopTimer, useNow, useTimer } from "@/lib/client/timer";
import { errorMessage } from "@/lib/client/api";
import { entrySeconds, FOCUS_MINUTES, focusRemaining, formatClock, formatDuration } from "@/lib/time";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Laufender Timer oben in der Navigation – Stoppuhr oder Fokus-Countdown. */
export function TimerPill() {
  const t = useT("time");
  const timer = useTimer();
  const now = useNow(Boolean(timer));
  const [done, setDone] = useState<string | null>(null);
  const stopping = useRef(false);

  // Nie mehr als das Ziel anzeigen – Server- und Browseruhr können eine Sekunde auseinanderliegen
  const remaining = timer?.focusMinutes ? Math.min(timer.focusMinutes * 60, focusRemaining(timer.startedAt, timer.focusMinutes, new Date(now))) : null;

  // Fokus vorbei: Eintrag abschließen, kurz feiern
  useEffect(() => {
    if (remaining === null || remaining > 0 || stopping.current) return;
    stopping.current = true;
    void stopTimer()
      .then(() => setDone(t("focusDone")))
      .finally(() => {
        stopping.current = false;
      });
  }, [remaining, t]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(null), 10_000);
    return () => clearTimeout(id);
  }, [done]);

  // Im Tab-Titel mitlaufen lassen
  useEffect(() => {
    if (!timer) return;
    const base = document.title.replace(/^⏱ \S+ · /, "");
    document.title = `⏱ ${remaining !== null ? formatClock(Math.max(0, remaining)) : formatClock(entrySeconds(timer.startedAt, null, new Date(now)))} · ${base}`;
    return () => {
      document.title = document.title.replace(/^⏱ \S+ · /, "");
    };
  }, [timer, now, remaining]);

  if (done && !timer) {
    return <span className="chip animate-pulse border-emerald-400/50 text-emerald-400" role="status">{done}</span>;
  }
  if (!timer) return null;

  const elapsed = entrySeconds(timer.startedAt, null, new Date(now));
  const label = timer.task?.title ?? timer.project.name;
  return (
    <div className={cn("flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-0.5 text-xs", remaining !== null ? "border-amber-400/50" : "border-accent/50")} data-testid="timer-pill">
      <Timer size={13} className={remaining !== null ? "text-amber-400" : "text-accent-ink"} />
      <Link href={`/projects/${timer.project.id}`} className="hidden max-w-40 truncate hover:text-accent-ink lg:inline" title={label}>{label}</Link>
      <span className="font-mono tabular-nums" title={remaining !== null ? t("focusLeft") : t("elapsed", { d: formatDuration(elapsed) })}>
        {remaining !== null ? formatClock(Math.max(0, remaining)) : formatClock(elapsed)}
      </span>
      <button className="btn btn-ghost btn-icon btn-sm !h-6 !w-6" onClick={() => void stopTimer()} aria-label={t("stop")} title={t("stop")}>
        <Square size={11} className="fill-current" />
      </button>
    </div>
  );
}

/**
 * Start-Knöpfe an einer Aufgabe: Stoppuhr und optional Fokus 25 min.
 * hoverOnly: erst beim Überfahren sichtbar (Karten im Board) – läuft der
 * Timer dieser Aufgabe, bleibt der Stopp-Knopf immer stehen.
 */
export function TimerButtons({ taskId, focus = false, hoverOnly = false, onError }: { taskId: string; focus?: boolean; hoverOnly?: boolean; onError?: (msg: string) => void }) {
  const t = useT("time");
  const timer = useTimer();
  const running = timer?.task?.id === taskId;
  const run = (fn: () => Promise<unknown>) => void fn().catch((e: unknown) => onError?.(errorMessage(e)));
  return (
    <span className={cn("inline-flex shrink-0 items-center", hoverOnly && !running && "opacity-0 transition group-hover:opacity-100 focus-within:opacity-100")}>
      {running ? (
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => run(stopTimer)} aria-label={t("stop")} title={t("stop")}>
          <Square size={13} className="fill-accent text-accent" />
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => run(() => startTimer(taskId))} aria-label={t("start")} title={t("start")}>
          <Timer size={14} className="text-muted" />
        </button>
      )}
      {focus && !running && (
        <button type="button" className="btn btn-ghost btn-sm !px-1.5 text-xs text-muted" onClick={() => run(() => startTimer(taskId, FOCUS_MINUTES))} title={t("focusTitle")}>
          {t("focus")}
        </button>
      )}
    </span>
  );
}
