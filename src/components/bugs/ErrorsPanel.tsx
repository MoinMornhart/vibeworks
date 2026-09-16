"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Check, ChevronDown, Copy, EyeOff, KeyRound, ListPlus, RotateCcw, Trash2, Zap } from "lucide-react";
import type { AppErrorItem } from "@/lib/bugs";
import { snippets, type ErrorStatus } from "@/lib/bugsLogic";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";

type Filter = ErrorStatus | "all";
type Snippet = "browser" | "node" | "curl";
interface Data {
  errors: AppErrorItem[];
  enabled: boolean;
  endpoint: string | null;
  canManage: boolean;
  /** Fehler-Agent (#39): off · notfix */
  autoTask: string;
}

const FILTERS: Filter[] = ["open", "resolved", "ignored", "all"];
const SNIPPETS: Snippet[] = ["browser", "node", "curl"];
const POLL_MS = 60_000;

function CopyButton({ text }: { text: string }) {
  const t = useT("bugs");
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
    <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy()}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? t("copied") : t("copy")}
    </button>
  );
}

/** Fehler-Eingang: Adresse und Schnipsel (Besitzer), zusammengefasste Fehler mit Erledigt/Ignorieren/Als Aufgabe. */
export function ErrorsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const t = useT("bugs");
  const f = useFormat();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Snippet>("browser");
  const [showSetup, setShowSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/projects/${projectId}/errors`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

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

  async function setAutoTask(mode: string) {
    const res = await run(() => api<Data>(`/api/projects/${projectId}/errors`, { body: { action: "autoTask", mode } }));
    if (res) setData(res);
  }

  async function manage(action: "enable" | "rotate" | "disable") {
    const res = await run(() => api<Data>(`/api/projects/${projectId}/errors`, { body: { action } }));
    if (res) {
      setData(res);
      setShowSetup(action !== "disable");
    }
  }

  function replace(item: AppErrorItem) {
    setData((d) => (d ? { ...d, errors: d.errors.map((x) => (x.id === item.id ? item : x)) } : d));
  }

  async function patch(item: AppErrorItem, body: { status: ErrorStatus } | { action: "task" | "notfix" }) {
    const res = await run(() => api<{ item: AppErrorItem }>(`/api/projects/${projectId}/errors/${item.id}`, { method: "PATCH", body }));
    if (res) {
      replace(res.item);
      if ("action" in body) {
        toast(t("taskCreated"));
        router.refresh(); // neue Aufgabe im Board
      }
    }
  }

  async function remove(item: AppErrorItem) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await run(() => api<{ ok: boolean }>(`/api/projects/${projectId}/errors/${item.id}`, { method: "DELETE" }));
    if (res) setData((d) => (d ? { ...d, errors: d.errors.filter((x) => x.id !== item.id) } : d));
  }

  const errors = data?.errors ?? [];
  const counts = Object.fromEntries(FILTERS.map((k) => [k, k === "all" ? errors.length : errors.filter((e) => e.status === k).length])) as Record<Filter, number>;
  const shown = filter === "all" ? errors : errors.filter((e) => e.status === filter);
  const code = data?.endpoint ? snippets(data.endpoint) : null;

  return (
    <section id="fehler" className="glass p-6 sm:p-8" aria-labelledby="bugs-heading">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="bugs-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Bug size={18} className={counts.open ? "text-red-400" : "text-emerald-400"} /> {t("title")}
          {counts.open > 0 && <span className="rounded-md border border-red-500/40 bg-red-500/10 px-1.5 text-xs text-red-400">{counts.open}</span>}
        </h2>
        {data?.canManage && (
          <div className="ml-auto flex flex-wrap gap-2">
            {data.enabled ? (
              <>
                <button type="button" className={cn("btn btn-sm", showSetup && "chip-active")} aria-expanded={showSetup} onClick={() => setShowSetup((s) => !s)}>
                  <KeyRound size={14} /> {t("setup")}
                </button>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => window.confirm(t("confirmRotate")) && void manage("rotate")}>
                  <RotateCcw size={14} /> {t("rotate")}
                </button>
                <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy} onClick={() => window.confirm(t("confirmDisable")) && void manage("disable")}>
                  {t("disable")}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void manage("enable")}>
                {t("enable")}
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">{t("hint")}</p>
      {data?.canManage && data.enabled && (
        <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border bg-bg/25 px-3 py-2" data-testid="auto-notfix">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--vw-accent)]"
            checked={data.autoTask === "notfix"}
            disabled={busy}
            onChange={(e) => void setAutoTask(e.target.checked ? "notfix" : "off")}
          />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap size={14} className="text-amber-400" /> {t("autoTask.label")}
            </span>
            <span className="block text-xs text-muted">{t("autoTask.hint")}</span>
          </span>
        </label>
      )}

      {data && !data.enabled && errors.length === 0 && <p className="text-sm text-muted">{data.canManage ? t("off") : t("offMember")}</p>}

      {showSetup && data?.endpoint && code && (
        <div className="mb-5 space-y-3 rounded-2xl border bg-bg/30 p-4" data-testid="bugs-setup">
          <div>
            <span className="label">{t("endpoint")}</span>
            <div className="flex gap-2">
              <input readOnly value={data.endpoint} onFocus={(e) => e.target.select()} className="field min-w-0 flex-1 font-mono text-xs" aria-label={t("endpoint")} />
              <CopyButton text={data.endpoint} />
            </div>
            <p className="mt-1 text-xs text-muted">{t("keyHint")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {SNIPPETS.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={tab === s} className={cn("chip", tab === s && "chip-active")} onClick={() => setTab(s)}>
                {t(`snippets.${s}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{t(`snippetHint.${tab}`)}</p>
          <div className="relative">
            <pre className="max-h-72 overflow-auto rounded-lg border bg-bg/40 p-3 font-mono text-xs leading-relaxed">{code[tab]}</pre>
            <div className="absolute right-2 top-2">
              <CopyButton text={code[tab]} />
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((k) => (
              <button key={k} type="button" className={cn("chip", filter === k && "chip-active")} onClick={() => setFilter(k)}>
                {t(`filters.${k}`)} <span className="tabular-nums text-muted">{counts[k]}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">{filter === "open" ? t("emptyOpen") : t("empty")}</p>
          ) : (
            <ul className="divide-y divide-fg/10" data-testid="bugs-list">
              {shown.map((e) => {
                const open = openId === e.id;
                return (
                  <li key={e.id} className="py-2.5">
                    <button type="button" className="flex w-full items-start gap-3 text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : e.id)}>
                      <span className="mt-0.5 shrink-0 rounded-md border px-1.5 font-mono text-[11px] tabular-nums text-muted">{t("count", { n: e.count })}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block break-words text-sm font-medium", e.status !== "open" && "text-muted line-through decoration-fg/30")}>
                          {e.type && <span className="text-red-400">{e.type}: </span>}
                          {e.message}
                        </span>
                        <span className="block text-xs text-muted" suppressHydrationWarning>
                          {t("lastSeen", { ago: f.ago(e.lastSeen) })}
                          {e.release && ` · ${t("release")} ${e.release}`}
                          {e.environment && ` · ${e.environment}`}
                        </span>
                      </span>
                      <ChevronDown size={14} className={cn("mt-1 shrink-0 text-muted transition", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="mt-2 space-y-2 pl-2 sm:pl-12">
                        {e.stack && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-bg/40 p-3 font-mono text-[11px] leading-relaxed text-muted">{e.stack}</pre>}
                        <dl className="grid gap-x-3 gap-y-0.5 text-xs text-muted sm:grid-cols-[auto_1fr]">
                          {/* Fremde Angaben nur als Text – nie als Link */}
                          {e.url && (
                            <>
                              <dt>{t("page")}</dt>
                              <dd className="break-all font-mono">{e.url}</dd>
                            </>
                          )}
                          {e.userAgent && (
                            <>
                              <dt>{t("client")}</dt>
                              <dd className="break-all">{e.userAgent}</dd>
                            </>
                          )}
                          <dt>{t("details")}</dt>
                          <dd suppressHydrationWarning>{t("firstSeen", { ago: f.ago(e.firstSeen) })}</dd>
                        </dl>
                        {canEdit && (
                          <div className="flex flex-wrap gap-2">
                            {e.status === "open" ? (
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void patch(e, { status: "resolved" })}>
                                <Check size={14} /> {t("actions.resolve")}
                              </button>
                            ) : (
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void patch(e, { status: "open" })}>
                                <RotateCcw size={14} /> {t("actions.reopen")}
                              </button>
                            )}
                            {e.status !== "ignored" && (
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void patch(e, { status: "ignored" })}>
                                <EyeOff size={14} /> {t("actions.ignore")}
                              </button>
                            )}
                            <button type="button" className="btn btn-sm" disabled={busy || Boolean(e.taskId)} onClick={() => void patch(e, { action: "task" })}>
                              <ListPlus size={14} /> {e.taskId ? t("actions.taskDone") : t("actions.task")}
                            </button>
                            {!e.taskId && (
                              <button type="button" className="btn btn-sm !text-amber-400" disabled={busy} data-testid="notfix" title={t("actions.notfixHint")} onClick={() => void patch(e, { action: "notfix" })}>
                                <Zap size={14} /> {t("actions.notfix")}
                              </button>
                            )}
                            <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy} onClick={() => void remove(e)}>
                              <Trash2 size={14} /> {t("actions.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
