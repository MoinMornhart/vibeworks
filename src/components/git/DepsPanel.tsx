"use client";

import { useState } from "react";
import { ExternalLink, PackageSearch, RefreshCw, ShieldAlert } from "lucide-react";
import type { DepsReport, Severity, UpdateLevel } from "@/lib/git/depsLogic";
import { severityRank } from "@/lib/git/depsLogic";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<UpdateLevel, string> = {
  major: "border-red-500/40 bg-red-500/10 text-red-400",
  minor: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  patch: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  current: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  unknown: "text-muted",
};
const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-red-400",
  high: "text-red-400",
  moderate: "text-amber-400",
  low: "text-sky-400",
  info: "text-muted",
};

/** Abhängigkeiten aus package.json: veraltet, Sicherheitswarnungen, „Jetzt prüfen“. */
export function DepsPanel({ projectId, initial, canCheck }: { projectId: string; initial: DepsReport | null; canCheck: boolean }) {
  const t = useT("deps");
  const f = useFormat();
  const msg = useMsg();
  const [report, setReport] = useState(initial);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ report: DepsReport }>(`/api/projects/${projectId}/deps`, { body: {} });
      setReport(res.report);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const c = report?.counts;
  const rows = report ? report.packages.filter((p) => !onlyIssues || p.advisories.length > 0 || ["major", "minor", "patch"].includes(p.level)) : [];

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="deps-heading">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="deps-heading" className="flex items-center gap-2 text-lg font-semibold"><PackageSearch size={18} className="text-sky-400" /> {t("title")}</h2>
        {report?.checkedAt && <span className="text-xs text-muted" suppressHydrationWarning>{t("checked", { ago: f.ago(report.checkedAt) })}</span>}
        {canCheck && (
          <button className="btn btn-sm ml-auto" disabled={busy} onClick={() => void check()}>
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? t("checking") : t("check")}
          </button>
        )}
      </div>

      {!report && <p className="text-sm text-muted">{t("never")}</p>}
      {report?.error && <p className="text-sm text-red-400">{t("failed", { error: msg(report.error) })}</p>}
      {report && !report.error && !report.manifest && <p className="text-sm text-muted">{t("noManifest")}</p>}

      {report && report.manifest && !report.error && c && (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="deps-summary">
            {c.outdated === 0 && c.vulnerable === 0 ? (
              <span className="text-emerald-400">{t("allGood", { n: c.total })}</span>
            ) : (
              <>
                <span>{t("outdated", { n: c.outdated, total: c.total })}</span>
                {c.major > 0 && <span className="rounded-md border border-red-500/40 bg-red-500/10 px-1.5 text-xs text-red-400">{t("majorCount", { n: c.major })}</span>}
                {c.vulnerable > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-1.5 text-xs text-red-400">
                    <ShieldAlert size={12} /> {t("vulnerable", { n: c.vulnerable })}
                  </span>
                )}
              </>
            )}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--vw-accent)]" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
              {t("onlyIssues")}
            </label>
          </p>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">{t("cols.name")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("cols.current")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("cols.latest")}</th>
                    <th className="py-1.5 font-medium">{t("cols.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fg/10">
                  {rows.map((p) => {
                    const worst = [...p.advisories].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
                    return (
                      <tr key={p.name} data-testid="dep">
                        <td className="py-1.5 pr-3">
                          <a href={`https://www.npmjs.com/package/${p.name}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-accent-ink">
                            {p.name} <ExternalLink size={10} />
                          </a>
                          {p.dev && <span className="ml-1.5 text-[10px] text-muted">{t("dev")}</span>}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-xs text-muted">{p.range}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{p.latest ?? "–"}</td>
                        <td className="py-1.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className={cn("rounded-md border px-1.5 text-[11px]", LEVEL_TONE[p.level])}>{t(`level.${p.level}`)}</span>
                            {worst && (
                              <a
                                href={worst.url ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn("inline-flex items-center gap-1 text-[11px] hover:underline", SEVERITY_TONE[worst.severity])}
                                title={p.advisories.map((a) => a.title).join("\n")}
                              >
                                <ShieldAlert size={11} /> {t(`severity.${worst.severity}`)}{p.advisories.length > 1 ? ` +${p.advisories.length - 1}` : ""}
                              </a>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
