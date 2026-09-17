"use client";

import { useState } from "react";
import { ExternalLink, Filter, GitPullRequest, Plus, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useMsg, useT } from "@/lib/i18n/client";
import { PROTECTED_PRESETS, TRASH_PRESETS, type FilterKind, type FilterRule } from "@/lib/git/fileFilterLogic";
import type { FilterView } from "@/lib/git/fileFilter";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/client/dialogs";

/** Dateifilter (#92): Müll erkennen und per Pull Request entfernen, wichtige Dateien schützen, Pull Requests prüfen. */
export function FileFilterPanel({ projectId, canEdit, webUrl }: { projectId: string; canEdit: boolean; webUrl: string }) {
  const t = useT("git");
  const msg = useMsg();
  const [view, setView] = useState<FilterView | null>(null);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [kind, setKind] = useState<FilterKind>("trash");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function apply(v: FilterView) {
    setView(v);
    setRules(v.filter.rules);
    setPicked(new Set(v.scan?.trash.map((x) => x.file) ?? []));
  }

  async function run<T extends { view: FilterView }>(p: Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await p;
      apply(res.view);
      return res;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const load = () => void run(api<{ view: FilterView }>(`/api/projects/${projectId}/file-filter`));
  const saveRules = (next: FilterRule[]) => void run(api<{ view: FilterView }>(`/api/projects/${projectId}/file-filter`, { method: "PUT", body: { rules: next } }));
  const addRule = (p: string, k: FilterKind) => {
    const clean = p.trim();
    if (!clean || rules.some((r) => r.pattern === clean && r.kind === k)) return;
    saveRules([...rules, { pattern: clean, kind: k }]);
  };
  const toggle = (file: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(file)) n.delete(file);
      else n.add(file);
      return n;
    });

  async function cleanup() {
    if (!view?.scan || !picked.size || !(await confirmDialog(t("filter.confirmCleanup", { n: picked.size }), { danger: true }))) return;
    const patterns = view.scan.suggestions.filter((s) => picked.has(s.file)).map((s) => s.pattern);
    const res = await run(api<{ view: FilterView; pr: { url: string; number: number } }>(`/api/projects/${projectId}/file-filter`, { body: { action: "cleanup", files: [...picked], patterns } }));
    if (res) toast(t("filter.prCreated", { n: res.pr.number }));
    if (res) window.open(res.pr.url, "_blank", "noopener,noreferrer");
  }

  const trashRules = rules.filter((r) => r.kind === "trash");
  const protectedRules = rules.filter((r) => r.kind === "protected");

  return (
    <section id="file-filter" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="file-filter-heading" data-testid="file-filter">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="file-filter-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Filter size={18} className="text-accent-ink" /> {t("filter.title")}
        </h2>
        <button type="button" className={cn("btn btn-sm", !view && "btn-primary")} onClick={load} disabled={busy} data-testid="file-filter-load">
          <RefreshCw size={14} className={cn(busy && "animate-spin")} /> {view ? t("filter.reload") : t("filter.load")}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">{t("filter.hint")}</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{msg(error)}</p>}

      {view && (
        <div className="space-y-5 text-sm">
          {/* Regeln */}
          <div className="grid gap-4 md:grid-cols-2">
            {(["trash", "protected"] as const).map((k) => {
              const list = k === "trash" ? trashRules : protectedRules;
              const presets = (k === "trash" ? TRASH_PRESETS : PROTECTED_PRESETS).filter((p) => !list.some((r) => r.pattern === p));
              return (
                <div key={k} className="rounded-xl border px-3 py-2" data-testid={`file-filter-rules-${k}`}>
                  <p className="flex items-center gap-1.5 font-medium">
                    {k === "trash" ? <Trash2 size={14} className="text-amber-300" /> : <ShieldCheck size={14} className="text-emerald-400" />} {t(`filter.kind.${k}`)}
                  </p>
                  <p className="mb-2 text-xs text-muted">{t(`filter.kindHint.${k}`)}</p>
                  <div className="flex flex-wrap gap-1">
                    {list.length === 0 && <span className="text-xs text-muted">{t("filter.noRules")}</span>}
                    {list.map((r) => (
                      <span key={r.pattern} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs">
                        {r.pattern}
                        {canEdit && (
                          <button type="button" className="text-muted hover:text-red-400" aria-label={t("filter.removeRule", { pattern: r.pattern })} disabled={busy} onClick={() => saveRules(rules.filter((x) => x !== r))}>
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {canEdit && presets.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {presets.slice(0, 12).map((p) => (
                        <button key={p} type="button" className="chip !py-0 font-mono text-[11px]" disabled={busy} onClick={() => addRule(p, k)}>
                          + {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {canEdit && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addRule(pattern, kind);
                setPattern("");
              }}
            >
              <input
                className="field min-w-0 flex-1 font-mono text-xs"
                placeholder={t("filter.patternPlaceholder")}
                aria-label={t("filter.patternPlaceholder")}
                value={pattern}
                maxLength={120}
                onChange={(e) => setPattern(e.target.value)}
                data-testid="file-filter-pattern"
              />
              <select className="field !w-auto text-xs" value={kind} onChange={(e) => setKind(e.target.value as FilterKind)} aria-label={t("filter.kindLabel")}>
                <option value="trash">{t("filter.kind.trash")}</option>
                <option value="protected">{t("filter.kind.protected")}</option>
              </select>
              <button className="btn btn-sm" disabled={busy || !pattern.trim()} data-testid="file-filter-add">
                <Plus size={13} /> {t("filter.addRule")}
              </button>
            </form>
          )}

          {/* Scan */}
          {!view.scan ? (
            <p className="text-xs text-muted">{view.scanError ? msg(view.scanError) : t("filter.noCopy")}</p>
          ) : (
            <div className="space-y-3">
              {view.scan.missingProtected.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs" data-testid="file-filter-missing">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0 text-red-400" /> {t("filter.missing", { list: view.scan.missingProtected.join(", ") })}
                </p>
              )}
              <p className="text-xs text-muted">{t("filter.protectedCount", { n: view.scan.protectedFiles.length })}</p>
              {[...view.scan.trash.map((x) => ({ ...x, suggestion: false })), ...view.scan.suggestions.map((x) => ({ ...x, suggestion: true }))].length === 0 ? (
                <p className="text-xs text-emerald-400">{t("filter.clean")}</p>
              ) : (
                <div className="rounded-xl border px-3 py-2">
                  <p className="mb-1 font-medium">{t("filter.found")}</p>
                  <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                    {[...view.scan.trash.map((x) => ({ ...x, suggestion: false })), ...view.scan.suggestions.map((x) => ({ ...x, suggestion: true }))].map((x) => (
                      <li key={x.file} className="flex items-center gap-2 text-xs" data-testid="file-filter-hit">
                        {canEdit && <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--vw-accent)]" checked={picked.has(x.file)} onChange={() => toggle(x.file)} aria-label={x.file} />}
                        <code className="min-w-0 flex-1 break-all">{x.file}</code>
                        <span className={cn("rounded px-1 font-mono text-[10px]", x.suggestion ? "bg-sky-400/15 text-sky-300" : "bg-amber-400/15 text-amber-300")}>
                          {x.suggestion ? t("filter.suggestion", { pattern: x.pattern }) : x.pattern}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canEdit && view.github && (
                    <button type="button" className="btn btn-primary btn-sm mt-2" disabled={busy || !picked.size} onClick={() => void cleanup()} data-testid="file-filter-cleanup">
                      <GitPullRequest size={13} /> {t("filter.cleanup", { n: picked.size })}
                    </button>
                  )}
                  {!view.github && <p className="mt-1 text-[11px] text-muted">{t("filter.githubOnly")}</p>}
                </div>
              )}
            </div>
          )}

          {/* Pull Requests */}
          {view.github && (
            <div className="rounded-xl border px-3 py-2" data-testid="file-filter-prs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="flex-1 font-medium">{t("filter.prsTitle")}</p>
                {canEdit && (
                  <button type="button" className="btn btn-sm" disabled={busy || !rules.length} onClick={() => void run(api<{ view: FilterView }>(`/api/projects/${projectId}/file-filter`, { body: { action: "check" } }))}>
                    {t("filter.checkNow")}
                  </button>
                )}
              </div>
              {view.prError && <p className="text-xs text-red-400">{msg(view.prError)}</p>}
              {!rules.length ? (
                <p className="text-xs text-muted">{t("filter.prsNeedRules")}</p>
              ) : view.prs.length === 0 ? (
                <p className="text-xs text-muted">{t("filter.noPrs")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {view.prs.map((pr) => (
                    <li key={pr.number} className="text-xs" data-testid="file-filter-pr">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", pr.violations.length && !pr.allowed ? "bg-red-400" : "bg-emerald-400")} />
                        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                          #{pr.number} {pr.title}
                        </a>
                        {pr.allowed && <span className="rounded bg-emerald-400/15 px-1 text-[10px] text-emerald-300">{t("filter.allowed")}</span>}
                        {canEdit && pr.violations.length > 0 && !pr.allowed && (
                          <button
                            type="button"
                            className="btn btn-sm ml-auto"
                            disabled={busy}
                            onClick={() => void confirmDialog(t("filter.confirmAllow", { n: pr.number })).then((ok) => void (ok && run(api<{ view: FilterView }>(`/api/projects/${projectId}/file-filter`, { body: { action: "allow", pr: pr.number, sha: pr.sha } }))))}
                          >
                            {t("filter.allow")}
                          </button>
                        )}
                      </p>
                      {pr.violations.map((v, i) => (
                        <p key={i} className="ml-4 text-muted">
                          <code>{v.from ? `${v.from} → ${v.file}` : v.file}</code> – {t(`filter.violation.${v.kind}`)}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted">
                {t("filter.protectHint")}{" "}
                {webUrl && (
                  <a href={`${webUrl}/settings/branches`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-accent-ink hover:underline">
                    {t("filter.branchRules")} <ExternalLink size={10} />
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
