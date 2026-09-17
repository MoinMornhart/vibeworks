"use client";

import { useEffect, useState } from "react";
import { Ban, Check, CheckCircle2, ChevronRight, Circle, CircleDot, Copy, ListChecks, Pencil, Plus, SkipForward, Trash2, Workflow } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import type { RunView, WorkflowPayload, WorkflowView } from "@/lib/aiWorkflows";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

/** Auftrag für die KI in die Zwischenablage. */
export function CopyPrompt({ text, label }: { text: string; label?: string }) {
  const t = useT("workflows");
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ohne HTTPS gibt es keine Zwischenablage-API – dann klassisch
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 break-words rounded-lg border bg-black/20 px-2 py-1 text-xs">{text}</code>
      <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy()} data-testid="copy-prompt">
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? t("copied") : (label ?? t("copyPrompt"))}
      </button>
    </div>
  );
}

const toLines = (w: WorkflowView) => w.steps.map((s) => (s.check ? `${s.title} | ${s.check}` : s.title)).join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: title.trim(), check: rest.join("|").trim() };
    });

const STEP_ICON = { done: CheckCircle2, skipped: SkipForward, current: CircleDot, open: Circle } as const;
const STEP_TONE = { done: "text-emerald-400", skipped: "text-muted", current: "text-accent-ink", open: "text-muted" } as const;
const RUN_TONE: Record<string, string> = { running: "bg-accent/20 text-accent-ink", done: "bg-emerald-500/15 text-emerald-400", cancelled: "bg-fg/10 text-muted" };

/** KI-Workflows (#101): mitgelieferte und eigene Checklisten, dazu die letzten Durchläufe. */
export function WorkflowPanel({ projectId, projectName, canEdit, canRun }: { projectId: string; projectName: string; canEdit: boolean; canRun: boolean }) {
  const t = useT("workflows");
  const f = useFormat();
  const [data, setData] = useState<WorkflowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ key: string | null; title: string; description: string; steps: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<WorkflowPayload>(`/api/projects/${projectId}/workflows`)
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function save() {
    if (!form) return;
    const steps = fromLines(form.steps);
    if (!steps.length || steps.some((s) => s.title.length < 3)) {
      toast(t("form.noSteps"), "error");
      return;
    }
    setBusy(true);
    try {
      const body = { title: form.title, description: form.description, steps };
      const res: WorkflowPayload & { key?: string } = form.key
        ? await api<WorkflowPayload>(`/api/projects/${projectId}/workflows/${form.key}`, { method: "PATCH", body })
        : await api<WorkflowPayload & { key: string }>(`/api/projects/${projectId}/workflows`, { body });
      setData(res);
      setOpen(form.key ?? res.key ?? null);
      setForm(null);
      toast(t("form.saved"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: WorkflowView) {
    if (!window.confirm(t("confirmDelete", { title: w.title }))) return;
    try {
      setData(await api<WorkflowPayload>(`/api/projects/${projectId}/workflows/${w.key}`, { method: "DELETE" }));
      toast(t("form.deleted"));
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  async function cancelRun(r: RunView) {
    if (!window.confirm(t("runs.confirmCancel", { title: r.title }))) return;
    try {
      const res = await api<{ run: RunView }>(`/api/workflow-runs/${r.id}`, { method: "PATCH", body: { cancel: true } });
      setData((d) => (d ? { ...d, runs: d.runs.map((x) => (x.id === r.id ? res.run : x)) } : d));
      toast(t("runs.cancelled"));
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <section id="workflows" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="workflows-heading" data-testid="workflows">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="workflows-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Workflow size={18} className="text-accent-ink" /> {t("title")}
        </h2>
        {canEdit && data && !form && (
          <button type="button" className="btn btn-sm" onClick={() => setForm({ key: null, title: "", description: "", steps: "" })} data-testid="workflow-create">
            <Plus size={14} /> {t("create")}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">{t("description")}</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <div className="h-16 animate-pulse rounded-xl bg-fg/5" />}

      {form && (
        <div className="mb-4 space-y-2 rounded-2xl border p-3" data-testid="workflow-form">
          <input className="field" placeholder={t("form.title")} aria-label={t("form.title")} value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="field" placeholder={t("form.description")} aria-label={t("form.description")} value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="block text-xs text-muted">
            {t("form.steps")}
            <textarea className="field mt-1 min-h-32 font-mono text-xs" placeholder={t("form.stepsPlaceholder")} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} />
          </label>
          <p className="text-xs text-muted">{t("form.hint")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(null)} disabled={busy}>
              {t("form.cancel")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy || form.title.trim().length < 2} data-testid="workflow-save">
              {t("form.save")}
            </button>
          </div>
        </div>
      )}

      {data && (
        <ul className="space-y-1.5">
          {data.workflows.map((w) => (
            <li key={w.key} className="rounded-xl border bg-bg/25" data-testid="workflow" data-key={w.key}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen(open === w.key ? null : w.key)} aria-expanded={open === w.key}>
                <ChevronRight size={14} className={cn("shrink-0 transition-transform", open === w.key && "rotate-90")} />
                <span className="font-medium">{w.title}</span>
                <span className={cn("rounded-full px-1.5 text-[10px]", w.builtin ? "bg-fg/10 text-muted" : "bg-accent/20 text-accent-ink")}>{w.builtin ? t("builtin") : t("own")}</span>
                <code className="text-[11px] text-muted">{w.key}</code>
                <span className="ml-auto shrink-0 text-xs text-muted">{t("steps", { n: w.steps.length })}</span>
              </button>
              {open === w.key && (
                <div className="space-y-3 border-t border-fg/10 px-3 py-3 text-sm" data-testid="workflow-detail">
                  {w.description && <p className="text-muted">{w.description}</p>}
                  <ol className="space-y-1.5">
                    {w.steps.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span>
                        <span>
                          {s.title}
                          {s.check && <span className="block text-xs text-muted">{t("check")}: {s.check}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <CopyPrompt text={t("startPrompt", { key: w.key, name: projectName })} />
                  {!w.builtin && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {w.authorName && <span>{t("by", { name: w.authorName })}</span>}
                      {canEdit && (
                        <>
                          <span className="flex-1" />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ key: w.key, title: w.title, description: w.description, steps: toLines(w) })}>
                            <Pencil size={13} /> {t("editOwn")}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm hover:text-red-400" onClick={() => void remove(w)} data-testid="workflow-delete">
                            <Trash2 size={13} /> {t("delete")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ListChecks size={15} /> {t("runs.title")}
          </h3>
          {data.runs.length === 0 ? (
            <p className="text-sm text-muted">{t("runs.empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {data.runs.map((r) => (
                <li key={r.id} className="rounded-xl border px-3 py-2 text-sm" data-testid="workflow-run" data-status={r.status}>
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <span className={cn("rounded-full px-1.5 text-[10px]", RUN_TONE[r.status])}>{t(`runs.status.${r.status === "done" || r.status === "cancelled" ? r.status : "running"}`)}</span>
                      <span className="text-xs tabular-nums text-muted">{t("runs.progress", { done: r.done, total: r.total })}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-fg/10" aria-hidden>
                        <span className="block h-full bg-accent" style={{ width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%` }} />
                      </span>
                      <span className="ml-auto text-xs text-muted" suppressHydrationWarning>{t("runs.started", { when: f.ago(r.startedAt) })}</span>
                    </summary>
                    <ol className="mt-2 space-y-1.5">
                      {r.steps.map((s) => {
                        const Icon = STEP_ICON[s.status];
                        return (
                          <li key={s.n} className="flex gap-2">
                            <Icon size={15} className={cn("mt-0.5 shrink-0", STEP_TONE[s.status])} aria-label={t(`runs.stepStatus.${s.status}`)} />
                            <span className={cn(s.status === "skipped" && "line-through decoration-fg/30")}>
                              {s.n}. {s.title}
                              {s.note && <span className="block whitespace-pre-line text-xs text-muted">{s.note}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    {r.summary && <p className="mt-2 text-xs text-muted">{r.summary}</p>}
                    {r.status === "running" && canRun && (
                      <button type="button" className="btn btn-ghost btn-sm mt-2 hover:text-red-400" onClick={() => void cancelRun(r)} data-testid="workflow-run-cancel">
                        <Ban size={13} /> {t("runs.cancel")}
                      </button>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
