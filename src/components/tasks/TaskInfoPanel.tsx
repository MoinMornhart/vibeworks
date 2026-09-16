"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, Clock, ExternalLink, GitCommit, History, MessageSquareText, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { TaskInfo } from "@/lib/taskInfo";
import { shortDuration } from "@/lib/taskInfoLogic";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { PriorityBadge } from "@/components/projects/ProjectCard";
import { cn } from "@/lib/utils";

/** Läuft sekündlich mit – für „seit 12 min in Arbeit“ auf Karte und im Fenster. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDuration() {
  const t = useT("tasks");
  return useCallback((seconds: number) => shortDuration(seconds, { s: t("info.unit.s"), min: t("info.unit.min"), h: t("info.unit.h"), d: t("info.unit.d") }), [t]);
}

/** Tickende Uhr an der Karte, solange die Aufgabe in Arbeit ist. */
export function WorkClock({ since, who }: { since: string; who: string | null }) {
  const t = useT("tasks");
  const now = useNow(30_000);
  const duration = useDuration();
  const seconds = (now - new Date(since).getTime()) / 1000;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-500/15 px-1.5 py-px text-[11px] text-violet-300" title={t("info.workingSince", { who: who ?? "?", time: duration(seconds) })} data-testid="task-work-clock">
      <Clock size={11} className="animate-pulse" /> {duration(seconds)}
    </span>
  );
}

/** Schwebendes Info-Fenster einer Aufgabe (#48/#49): Verlauf, KI-Schritte, Commits, Zeit. */
export function TaskInfoPanel({ taskId, title, onClose, canEdit = false }: { taskId: string; title: string; onClose: () => void; canEdit?: boolean }) {
  const t = useT("tasks");
  const ts = useT("status");
  const f = useFormat();
  const duration = useDuration();
  const now = useNow(15_000);
  const [info, setInfo] = useState<TaskInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo((await api<{ info: TaskInfo }>(`/api/tasks/${taskId}/info`)).info);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
    // Solange offen: alle 30 s nachsehen, was sich getan hat
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), 30_000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [load, onClose]);

  if (typeof document === "undefined") return null;
  const doing = info?.status === "DOING";

  return createPortal(
    <aside
      role="complementary"
      aria-label={t("info.title")}
      data-testid="task-info"
      className="glass-strong fade-in fixed inset-x-3 bottom-3 z-40 bg-bg/95 backdrop-blur-xl flex max-h-[75dvh] flex-col rounded-2xl shadow-2xl sm:inset-x-auto sm:right-4 sm:top-24 sm:bottom-4 sm:max-h-none sm:w-[26rem]"
    >
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{t("info.title")}</p>
          <h2 className="break-words font-semibold leading-snug">{title}</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void load()} aria-label={t("info.reload")} disabled={loading}>
          <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t("info.close")}>
          <X size={16} />
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto px-4 py-3 text-sm">
        {error && <p className="text-red-400">{error}</p>}
        {!info && !error && <p className="text-muted">{t("info.loading")}</p>}
        {info && (
          <>
            <section className={cn("rounded-xl border px-3 py-2", doing && "border-violet-500/40 bg-violet-500/10")} data-testid="task-info-now">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{info.statusLabel || ts(`task.${info.status}`)}</span>
                <PriorityBadge priority={info.priority} />
                {info.assignee && <span className="text-muted">· {info.assignee}</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {doing
                  ? t("info.workingSince", { who: info.assignee ?? "?", time: duration((now - new Date(info.since).getTime()) / 1000) })
                  : t("info.statusSince", { ago: f.ago(info.since) })}
              </p>
              {info.totalSeconds > 0 && <p className="mt-0.5 text-xs text-muted">{t("info.tracked", { time: duration(info.totalSeconds) })}</p>}
              {info.issueUrl && (
                <a href={info.issueUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
                  {t("info.openIssue")} <ExternalLink size={11} />
                </a>
              )}
            </section>

            <AiNote taskId={taskId} initial={info.aiNote} canEdit={canEdit} />

            <Section icon={<Bot size={14} />} title={t("info.steps")} empty={t("info.noSteps")} count={info.steps.length}>
              {info.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 py-1" data-testid="task-info-step">
                  {s.ok ? <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" /> : <TriangleAlert size={13} className="mt-0.5 shrink-0 text-amber-400" />}
                  <span className="min-w-0 flex-1">
                    <code className="text-xs">{s.tool}</code>
                    <span className="block text-xs text-muted" suppressHydrationWarning>
                      {[s.client, s.who, f.ago(s.at)].filter(Boolean).join(" · ")}
                    </span>
                    {s.error && <span className="block break-words text-xs text-amber-400">{s.error}</span>}
                  </span>
                </li>
              ))}
            </Section>

            <Section icon={<GitCommit size={14} />} title={t("info.commits")} empty={t("info.noCommits")} count={info.commits.length}>
              {info.commits.map((c) => (
                <li key={c.sha} className="py-1">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="break-words hover:text-accent-ink">
                      <code className="mr-1 text-xs text-muted">{c.sha}</code>
                      {c.title}
                    </a>
                  ) : (
                    <span className="break-words">
                      <code className="mr-1 text-xs text-muted">{c.sha}</code>
                      {c.title}
                    </span>
                  )}
                  <span className="block text-xs text-muted" suppressHydrationWarning>
                    {c.author} · {f.ago(c.date)}
                  </span>
                </li>
              ))}
            </Section>

            <Section icon={<History size={14} />} title={t("info.history")} empty={t("info.noHistory")} count={info.activity.length}>
              {info.activity.map((a, i) => (
                <li key={i} className="py-1">
                  <span className="break-words">{a.summary}</span>
                  <span className="block text-xs text-muted" suppressHydrationWarning>
                    {[a.who, f.dateTime(a.at)].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </Section>

            {info.time.length > 0 && (
              <Section icon={<Clock size={14} />} title={t("info.time")} empty="" count={info.time.length}>
                {info.time.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2 py-1 text-xs">
                    <span suppressHydrationWarning>
                      {e.user} · {f.dateTime(e.startedAt)}
                    </span>
                    <span className={cn("tabular-nums", e.running && "text-violet-300")}>{e.running ? t("info.running") : duration(e.seconds)}</span>
                  </li>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
}

/** Hinweis an Claude (#59): eigener Prompt und Arbeitsweise – die KI bekommt ihn bei get_task/list_tasks mit. */
function AiNote({ taskId, initial, canEdit }: { taskId: string; initial: string | null; canEdit: boolean }) {
  const t = useT("tasks");
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setText(initial ?? "");
    setSaved(initial ?? "");
  }, [initial]);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: { aiNote: text.trim() || null } });
      setSaved(text);
      setNote(t("info.noteSaved"));
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const presets = [t("info.presets.review"), t("info.presets.tests"), t("info.presets.small"), t("info.presets.ask")];
  return (
    <section data-testid="task-ai-note">
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <MessageSquareText size={14} /> {t("info.noteTitle")}
      </h3>
      {!canEdit ? (
        <p className="whitespace-pre-wrap text-xs text-muted">{saved || t("info.noteEmpty")}</p>
      ) : (
        <>
          <textarea
            className="field min-h-20 text-sm"
            maxLength={4000}
            value={text}
            placeholder={t("info.notePlaceholder")}
            onChange={(e) => setText(e.target.value)}
            data-testid="task-ai-note-input"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button key={p} type="button" className="chip !py-0.5 text-[11px]" onClick={() => setText((v) => (v.includes(p) ? v : `${v.trim()}${v.trim() ? "\n" : ""}${p}`))}>
                + {p}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || text === saved} onClick={() => void save()} data-testid="task-ai-note-save">
              {t("info.noteSave")}
            </button>
            {note && <span className="text-xs text-muted">{note}</span>}
          </div>
          <p className="mt-1 text-[11px] text-muted">{t("info.noteHint")}</p>
        </>
      )}
    </section>
  );
}

function Section({ icon, title, empty, count, children }: { icon: React.ReactNode; title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon} {title} {count > 0 && <span className="tabular-nums">({count})</span>}
      </h3>
      {count === 0 ? <p className="text-xs text-muted">{empty}</p> : <ul className="divide-y divide-fg/10">{children}</ul>}
    </section>
  );
}
