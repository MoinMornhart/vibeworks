"use client";

import { useEffect, useState } from "react";
import { Layers, Pencil, Plus, Save, TriangleAlert, X } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import type { StructureRow } from "@/lib/projectStructureLogic";
import type { StructureView } from "@/lib/projectStructure";
import { toast } from "@/components/ui/Toaster";
import { CopyPrompt } from "./WorkflowPanel";
import { cn } from "@/lib/utils";

const EMPTY_ROW: StructureRow = { area: "", path: "", purpose: "", how: "" };

/** Projektaufbau (#101): Tabelle Bereich · Pfad · Zweck · Funktionsweise – gepflegt von KI und Mensch. */
export function StructurePanel({ projectId, projectName, canEdit }: { projectId: string; projectName: string; canEdit: boolean }) {
  const t = useT("workflows");
  const f = useFormat();
  const [view, setView] = useState<StructureView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [overview, setOverview] = useState("");
  const [rows, setRows] = useState<StructureRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ structure: StructureView }>(`/api/projects/${projectId}/structure`)
      .then((res) => alive && setView(res.structure))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [projectId]);

  function startEdit() {
    if (!view) return;
    setOverview(view.overview);
    setRows(view.rows.length ? view.rows : [EMPTY_ROW]);
    setEditing(true);
  }

  const setRow = (i: number, patch: Partial<StructureRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    const clean = rows.filter((r) => r.area.trim() || r.path.trim() || r.purpose.trim() || r.how.trim());
    if (clean.some((r) => !r.area.trim() || !r.purpose.trim())) {
      toast(t("structure.rowIncomplete"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ structure: StructureView }>(`/api/projects/${projectId}/structure`, { method: "PUT", body: { overview, rows: clean } });
      setView(res.structure);
      setEditing(false);
      toast(t("structure.saved"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const missing = new Set(view?.missingPaths ?? []);
  const unused = (view?.suggestedAreas ?? []).filter((s) => !rows.some((r) => r.path === s.path));

  return (
    <section id="aufbau" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="structure-heading" data-testid="structure">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="structure-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Layers size={18} className="text-accent-ink" /> {t("structure.title")}
        </h2>
        {canEdit && view && !editing && (
          <button type="button" className="btn btn-sm" onClick={startEdit} data-testid="structure-edit">
            <Pencil size={14} /> {t("structure.edit")}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">{t("structure.description")}</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!view && !error && <div className="h-16 animate-pulse rounded-xl bg-fg/5" />}

      {view && !editing && (
        <>
          {view.overview && <p className="mb-3 whitespace-pre-line text-sm" data-testid="structure-overview">{view.overview}</p>}
          {view.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm" data-testid="structure-empty">
              <p className="mb-2 text-muted">{t("structure.empty")}</p>
              <CopyPrompt text={t("structure.prompt", { name: projectName })} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm" data-testid="structure-table">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">{t("structure.col.area")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("structure.col.path")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("structure.col.purpose")}</th>
                    <th className="py-1.5 font-medium">{t("structure.col.how")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r, i) => (
                    <tr key={`${r.path}-${i}`} className="border-t border-fg/10 align-top" data-testid="structure-row">
                      <td className="py-2 pr-3 font-medium">{r.area}</td>
                      <td className="py-2 pr-3">
                        {r.path && (
                          <code className={cn("break-all rounded bg-fg/10 px-1 text-xs", missing.has(r.path) && "bg-amber-500/15 text-amber-300")} title={missing.has(r.path) ? t("structure.missing") : undefined}>
                            {missing.has(r.path) && <TriangleAlert size={11} className="mr-1 inline" />}
                            {r.path}
                          </code>
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.purpose}</td>
                      <td className="py-2 text-muted">{r.how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {view.updatedAt && <span suppressHydrationWarning>{t("structure.updated", { when: f.ago(view.updatedAt), by: view.updatedBy ?? "?" })}</span>}
            {missing.size > 0 && <span className="text-amber-300" data-testid="structure-missing">{t("structure.missingCount", { n: missing.size })}</span>}
            {!view.checked && view.rows.length > 0 && <span>{t("structure.notChecked")}</span>}
          </div>
        </>
      )}

      {view && editing && (
        <div className="space-y-3" data-testid="structure-form">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">{t("structure.overview")}</span>
            <textarea className="field min-h-16" value={overview} onChange={(e) => setOverview(e.target.value)} maxLength={2000} />
          </label>
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_1fr_1.4fr_2fr_auto]" data-testid="structure-form-row">
              <input className="field" placeholder={t("structure.col.area")} aria-label={t("structure.col.area")} value={r.area} maxLength={80} onChange={(e) => setRow(i, { area: e.target.value })} />
              <input className="field font-mono text-xs" placeholder={t("structure.col.path")} aria-label={t("structure.col.path")} value={r.path} maxLength={200} onChange={(e) => setRow(i, { path: e.target.value })} />
              <input className="field" placeholder={t("structure.col.purpose")} aria-label={t("structure.col.purpose")} value={r.purpose} maxLength={300} onChange={(e) => setRow(i, { purpose: e.target.value })} />
              <input className="field" placeholder={t("structure.col.how")} aria-label={t("structure.col.how")} value={r.how} maxLength={600} onChange={(e) => setRow(i, { how: e.target.value })} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm self-center" aria-label={t("structure.removeRow")} title={t("structure.removeRow")} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
          {unused.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">{t("structure.suggestions")}</span>
              {unused.slice(0, 20).map((s) => (
                <button key={s.path} type="button" className="chip !py-0.5 font-mono text-[11px]" onClick={() => setRows((rs) => [...rs.filter((r) => r.area || r.path || r.purpose), { ...EMPTY_ROW, path: s.path }])}>
                  + {s.path}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setRows((rs) => [...rs, EMPTY_ROW])} disabled={rows.length >= 80} data-testid="structure-add">
              <Plus size={14} /> {t("structure.addRow")}
            </button>
            <span className="flex-1" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
              {t("structure.cancel")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy} data-testid="structure-save">
              <Save size={14} /> {t("structure.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
