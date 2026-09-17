"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, CircleDashed, ExternalLink, Loader2, MinusCircle, Play, Plus, Save, Trash2, Upload, Workflow, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/Toaster";
import { MAX_STEPS, newStep, STEP_KINDS, STEP_WHEN, type CiPipeline, type CiStep, type NodeState, type StepKind } from "@/lib/git/ciPipelineLogic";
import type { CiStatus, CiView } from "@/lib/git/ciPipeline";
import { cn } from "@/lib/utils";

const STATE_ICON: Record<NodeState, React.ComponentType<{ size?: number; className?: string }>> = {
  idle: Circle,
  queued: CircleDashed,
  running: Loader2,
  success: CheckCircle2,
  failure: XCircle,
  skipped: MinusCircle,
};
const STATE_TONE: Record<NodeState, string> = {
  idle: "text-muted",
  queued: "text-amber-300",
  running: "animate-spin text-accent-ink",
  success: "text-emerald-400",
  failure: "text-red-400",
  skipped: "text-muted",
};
const SCHEDULES = { daily: "0 3 * * *", weekly: "0 3 * * 1" } as const;

/** CI-Designer (#107): Auslöser und Blöcke zusammenstellen, ins Repository schreiben, Lauf live verfolgen. */
export function CiPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const t = useT("ci");
  const f = useFormat();
  const [view, setView] = useState<CiView | null>(null);
  const [draft, setDraft] = useState<CiPipeline | null>(null);
  const [status, setStatus] = useState<CiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<number | null>(null);
  const [pushText, setPushText] = useState("");
  const poll = useRef<number | null>(null);
  const restartPoll = useRef<() => void>(() => undefined);

  const apply = (v: CiView) => {
    setView(v);
    setDraft(v.pipeline);
    setPushText(v.pipeline.triggers.push.join(", "));
  };

  useEffect(() => {
    api<{ ci: CiView }>(`/api/projects/${projectId}/ci`)
      .then((r) => apply(r.ci))
      .catch((e) => setError(errorMessage(e)));
  }, [projectId]);

  const loadStatus = useCallback(async () => {
    try {
      const s = (await api<{ status: CiStatus }>(`/api/projects/${projectId}/ci/status`)).status;
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, [projectId]);

  // Während ein Lauf aktiv ist: alle 5 s nachsehen, sonst jede Minute
  useEffect(() => {
    if (!view?.saved || !view.supported) return;
    let stopped = false;
    const tick = async () => {
      const s = await loadStatus();
      if (stopped) return;
      const active = s?.run && s.run.status !== "completed";
      poll.current = window.setTimeout(() => void tick(), active ? 5000 : 60_000);
    };
    restartPoll.current = () => {
      if (poll.current) window.clearTimeout(poll.current);
      void tick();
    };
    void tick();
    return () => {
      stopped = true;
      if (poll.current) window.clearTimeout(poll.current);
    };
  }, [view?.saved, view?.supported, loadStatus]);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const withPush = (p: CiPipeline): CiPipeline => ({
    ...p,
    triggers: { ...p.triggers, push: pushText.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) },
  });

  const save = () =>
    run(async () => {
      if (!draft) return;
      apply((await api<{ ci: CiView }>(`/api/projects/${projectId}/ci`, { method: "PUT", body: { pipeline: withPush(draft) } })).ci);
      toast(t("saved"));
    });
  const publish = () =>
    run(async () => {
      const res = await api<{ result: "created" | "updated" | "current"; ci: CiView }>(`/api/projects/${projectId}/ci`, { body: { action: "publish" } });
      apply(res.ci);
      toast(t(`published_${res.result}`));
    });
  const start = () =>
    run(async () => {
      await api(`/api/projects/${projectId}/ci`, { body: { action: "run" } });
      toast(t("started"));
      // GitHub braucht einen Moment, bis der Lauf in der Liste steht – dann eng mitverfolgen
      window.setTimeout(() => restartPoll.current(), 3000);
    });

  const setSteps = (steps: CiStep[]) => draft && setDraft({ ...draft, steps });
  const patchStep = (i: number, patch: Partial<CiStep>) => draft && setSteps(draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const next = [...draft.steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
  };
  const insert = (at: number, kind: StepKind) => {
    if (!draft) return;
    const base = newStep(kind, kind === "custom" ? { run: "" } : kind === "npm-script" ? { script: "test", name: "npm test" } : {});
    // Namen eindeutig halten – die Live-Anzeige ordnet über den Namen zu
    let name = base.name;
    for (let n = 2; draft.steps.some((s) => s.name.toLowerCase() === name.toLowerCase()); n++) name = `${base.name} ${n}`;
    const next = [...draft.steps];
    next.splice(at, 0, { ...base, name });
    setSteps(next);
    setPalette(null);
  };

  const scheduleMode = !draft?.triggers.schedule ? "off" : draft.triggers.schedule === SCHEDULES.daily ? "daily" : draft.triggers.schedule === SCHEDULES.weekly ? "weekly" : "custom";
  const nodes = status?.nodes ?? {};
  // Als Funktion, nicht als Komponente – sonst hängt React die Knöpfe bei jedem Rendern neu ein
  const inserter = (at: number) =>
    canEdit && draft && draft.steps.length < MAX_STEPS ? (
      <div className="py-1">
        <div className="relative flex justify-center">
          <span className="absolute inset-y-0 left-1/2 w-px bg-fg/15" aria-hidden />
          <button type="button" className="btn btn-ghost btn-icon btn-sm relative z-10 bg-bg" onClick={() => setPalette(palette === at ? null : at)} aria-label={t("addHere")} title={t("addHere")} aria-expanded={palette === at} data-testid="ci-insert">
            <Plus size={13} />
          </button>
        </div>
        {/* Im Ablauf statt schwebend – sonst verdeckt der nächste Abschnitt die Auswahl */}
        {palette === at && (
          <div className="mt-1 grid gap-1 rounded-xl border border-accent/40 bg-accent/5 p-2 text-sm sm:grid-cols-2" data-testid="ci-palette">
            {STEP_KINDS.map((k) => (
              <button key={k} type="button" className="rounded-lg px-2 py-1 text-left hover:bg-fg/10" onClick={() => insert(at, k)} data-kind={k}>
                <span className="font-medium">{t(`kinds.${k}`)}</span>
                <span className="block text-xs text-muted">{t(`kindHints.${k}`)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ) : (
      <div className="flex justify-center py-1" aria-hidden>
        <span className="h-4 w-px bg-fg/15" />
      </div>
    );

  return (
    <section id="ci" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="ci-heading" data-testid="ci">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 id="ci-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Workflow size={18} className="text-accent-ink" /> {t("title")}
        </h2>
        {status?.run && (
          <a href={status.run.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-accent-ink" data-testid="ci-run" data-status={status.run.status} suppressHydrationWarning>
            {t("lastRun", { status: status.run.status === "completed" ? t(`state.${status.run.conclusion === "success" ? "success" : "failure"}`) : t(`runStatus.${(["queued", "in_progress", "waiting", "requested", "pending"].includes(status.run.status) ? status.run.status : "completed") as "queued"}`), when: f.ago(status.run.startedAt) })}
            <ExternalLink size={11} />
          </a>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">{t("description")}</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
      {!view && !error && <div className="h-24 animate-pulse rounded-xl bg-fg/5" />}
      {view && !view.supported && <p className="text-sm text-muted">{t("githubOnly")}</p>}

      {view && view.supported && draft && (
        <div className="space-y-4">
          <p className="text-xs" data-testid="ci-state" suppressHydrationWarning>
            {!view.saved ? (
              <span className="text-amber-300">{t("suggested")}</span>
            ) : view.unpublished ? (
              <span className="text-amber-300">{t("unpublished")}</span>
            ) : view.publishedAt ? (
              <span className="text-emerald-400">{t("published", { when: f.ago(view.publishedAt), by: view.publishedBy ?? "?" })}</span>
            ) : null}
            {!view.hasToken && <span className="ml-2 text-red-400">{t("noToken")}</span>}
          </p>

          <fieldset className="grid gap-3 rounded-2xl border p-3 text-sm sm:grid-cols-2" disabled={!canEdit} data-testid="ci-triggers">
            <legend className="px-1 text-xs font-semibold text-muted">{t("triggers.title")}</legend>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-muted">{t("triggers.push")}</span>
              <input className="field font-mono text-xs" value={pushText} onChange={(e) => setPushText(e.target.value)} placeholder={t("triggers.pushPlaceholder")} data-testid="ci-push" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.triggers.pullRequest} onChange={(e) => setDraft({ ...draft, triggers: { ...draft.triggers, pullRequest: e.target.checked } })} />
              {t("triggers.pullRequest")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.triggers.manual} onChange={(e) => setDraft({ ...draft, triggers: { ...draft.triggers, manual: e.target.checked } })} data-testid="ci-manual" />
              {t("triggers.manual")}
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">{t("triggers.schedule")}</span>
              <select
                className="field"
                value={scheduleMode}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({ ...draft, triggers: { ...draft.triggers, schedule: v === "off" ? null : v === "custom" ? (draft.triggers.schedule ?? "30 2 * * *") : SCHEDULES[v as keyof typeof SCHEDULES] } });
                }}
                data-testid="ci-schedule"
              >
                <option value="off">{t("triggers.scheduleOff")}</option>
                <option value="daily">{t("triggers.daily")}</option>
                <option value="weekly">{t("triggers.weekly")}</option>
                <option value="custom">{t("triggers.custom")}</option>
              </select>
            </label>
            {scheduleMode === "custom" ? (
              <label>
                <span className="mb-1 block text-xs text-muted">{t("triggers.cron")}</span>
                <input className="field font-mono text-xs" value={draft.triggers.schedule ?? ""} onChange={(e) => setDraft({ ...draft, triggers: { ...draft.triggers, schedule: e.target.value } })} data-testid="ci-cron" />
              </label>
            ) : (
              <label>
                <span className="mb-1 block text-xs text-muted">{t("triggers.timeout")}</span>
                <input type="number" min={1} max={120} className="field" value={draft.timeoutMinutes} onChange={(e) => setDraft({ ...draft, timeoutMinutes: Math.max(1, Math.min(120, Number(e.target.value) || 20)) })} />
              </label>
            )}
          </fieldset>

          <div data-testid="ci-steps">
            <p className="mb-1 text-xs font-semibold text-muted">{t("steps")}</p>
            {inserter(0)}
            {draft.steps.map((s, i) => {
              const state = nodes[s.id] ?? "idle";
              const Icon = STATE_ICON[state];
              return (
                <div key={s.id}>
                  <div className={cn("rounded-2xl border bg-bg/30 p-3 transition-colors", state === "running" && "border-accent/60", state === "failure" && "border-red-500/50", state === "success" && "border-emerald-500/40")} data-testid="ci-node" data-kind={s.kind} data-state={state}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon size={18} className={cn("shrink-0", STATE_TONE[state])} />
                      <span className="sr-only">{t(`state.${state}`)}</span>
                      <input className="field w-auto min-w-0 flex-1 !py-1 font-medium" value={s.name} maxLength={60} disabled={!canEdit} onChange={(e) => patchStep(i, { name: e.target.value })} aria-label={t("name")} />
                      <span className="chip !py-0.5 text-[11px]">{t(`kinds.${s.kind}`)}</span>
                      {canEdit && (
                        <span className="flex gap-0.5">
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("up")} title={t("up")}>
                            <ArrowUp size={13} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)} aria-label={t("down")} title={t("down")}>
                            <ArrowDown size={13} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm hover:text-red-400" disabled={draft.steps.length <= 1} onClick={() => setSteps(draft.steps.filter((_, j) => j !== i))} aria-label={t("remove")} title={t("remove")} data-testid="ci-remove">
                            <Trash2 size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">{t(`kindHints.${s.kind}`)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        {t("when")}
                        <select className="field w-auto !py-0.5 text-xs" value={s.when} disabled={!canEdit} onChange={(e) => patchStep(i, { when: e.target.value as CiStep["when"] })}>
                          {STEP_WHEN.map((w) => (
                            <option key={w} value={w}>
                              {t(`whenOptions.${w}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {s.kind === "npm-script" && (
                        <label className="flex items-center gap-1">
                          {t("script")}
                          <input className="field w-28 !py-0.5 font-mono text-xs" value={s.script ?? ""} disabled={!canEdit} onChange={(e) => patchStep(i, { script: e.target.value })} />
                        </label>
                      )}
                      {(s.kind === "node-install" || s.kind === "python-install" || s.kind === "go-test") && (
                        <label className="flex items-center gap-1">
                          {t("version")}
                          <input className="field w-20 !py-0.5 font-mono text-xs" value={s.version ?? ""} disabled={!canEdit} onChange={(e) => patchStep(i, { version: e.target.value || undefined })} placeholder={s.kind === "node-install" ? "22" : s.kind === "python-install" ? "3.12" : "stable"} />
                        </label>
                      )}
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={s.continueOnError} disabled={!canEdit} onChange={(e) => patchStep(i, { continueOnError: e.target.checked })} />
                        {t("continueOnError")}
                      </label>
                    </div>
                    {s.kind === "custom" && (
                      <textarea
                        className="field mt-2 min-h-20 font-mono text-xs"
                        value={s.run ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => patchStep(i, { run: e.target.value })}
                        placeholder={"npm run e2e\n./scripts/check.sh"}
                        aria-label={t("run")}
                        spellCheck={false}
                        data-testid="ci-run-script"
                      />
                    )}
                  </div>
                  {inserter(i + 1)}
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save()} data-testid="ci-save">
                <Save size={14} /> {t("save")}
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !view.saved || !view.hasToken} onClick={() => void publish()} data-testid="ci-publish">
                <Upload size={14} /> {t("publish")}
              </button>
              <button type="button" className="btn btn-sm" disabled={busy || !view.publishedAt || !view.pipeline.triggers.manual} onClick={() => void start()} data-testid="ci-start">
                <Play size={14} /> {t("run_")}
              </button>
            </div>
          )}

          <details className="rounded-2xl border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">
              {t("yaml")} <code className="text-muted">{view.path}</code>
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre rounded-lg bg-black/30 p-3 font-mono text-[11px]" data-testid="ci-yaml">
              {view.yaml}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
