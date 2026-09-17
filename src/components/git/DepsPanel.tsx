"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, GitBranch, PackageSearch, RefreshCw, ShieldAlert } from "lucide-react";
import type { DepsReport, Severity, UpdateLevel } from "@/lib/git/depsLogic";
import { severityRank } from "@/lib/git/depsLogic";
import { packageUrl, type Ecosystem } from "@/lib/git/depsManifestLogic";
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

/** Abhängigkeiten aller Sprachen (#105): veraltet, Sicherheitswarnungen, Zweig wählbar, „Jetzt prüfen“. */
export function DepsPanel({ projectId, initial, canCheck, defaultBranch }: { projectId: string; initial: DepsReport | null; canCheck: boolean; defaultBranch: string | null }) {
  const t = useT("deps");
  const f = useFormat();
  const msg = useMsg();
  const router = useRouter();
  const [report, setReport] = useState(initial);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [ecosystem, setEcosystem] = useState<Ecosystem | "all">("all");
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState<string | null>(initial?.branch ?? defaultBranch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(wanted = branch) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ report: DepsReport }>(`/api/projects/${projectId}/deps`, { body: wanted && wanted !== defaultBranch ? { branch: wanted } : {} });
      setReport(res.report);
      setBranch(res.report.branch ?? wanted);
      if (!wanted || wanted === defaultBranch) router.refresh(); // Markiertes ist jetzt als Aufgabe im Board
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadBranches() {
    try {
      setBranches((await api<{ branches: string[] }>(`/api/projects/${projectId}/deps`)).branches);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const c = report?.counts;
  const ecosystems = [...new Set((report?.packages ?? []).map((p) => p.ecosystem ?? "npm"))];
  const rows = report
    ? report.packages.filter(
        (p) => (ecosystem === "all" || (p.ecosystem ?? "npm") === ecosystem) && (!onlyIssues || p.advisories.length > 0 || ["major", "minor", "patch"].includes(p.level)),
      )
    : [];
  const otherBranch = Boolean(report?.branch && defaultBranch && report.branch !== defaultBranch);

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="deps-heading" data-testid="deps">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="deps-heading" className="flex items-center gap-2 text-lg font-semibold"><PackageSearch size={18} className="text-sky-400" /> {t("title")}</h2>
        {report?.checkedAt && <span className="text-xs text-muted" suppressHydrationWarning>{t("checked", { ago: f.ago(report.checkedAt) })}</span>}
        {canCheck && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {branches && branches.length > 1 ? (
              <label className="flex items-center gap-1 text-xs">
                <GitBranch size={13} />
                <span className="sr-only">{t("branch")}</span>
                <select
                  className="field w-auto py-1 text-xs"
                  value={branch ?? ""}
                  disabled={busy}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    void check(e.target.value);
                  }}
                  data-testid="deps-branch"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadBranches()} disabled={busy || branches !== null} data-testid="deps-load-branches">
                <GitBranch size={13} /> {branch ?? t("loadBranches")}
              </button>
            )}
            <button className="btn btn-sm" disabled={busy} onClick={() => void check()} data-testid="deps-check">
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? t("checking") : t("check")}
            </button>
          </div>
        )}
      </div>

      {otherBranch && <p className="mb-2 text-xs text-amber-300" data-testid="deps-other-branch">{t("otherBranch")}</p>}
      {!report && <p className="text-sm text-muted">{t("never")}</p>}
      {report?.error && <p className="text-sm text-red-400">{t("failed", { error: msg(report.error) })}</p>}
      {report && !report.error && !report.manifest && <p className="text-sm text-muted">{t("noManifest")}</p>}

      {report && report.manifest && !report.error && c && (
        <>
          {report.manifests && report.manifests.length > 0 && (
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted" data-testid="deps-manifests">
              {t("foundIn")}
              {report.manifests.map((m) => (
                <code key={m.path} className="rounded bg-fg/10 px-1" title={m.ecosystem}>
                  {m.path} ({m.count})
                </code>
              ))}
            </p>
          )}
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
          {ecosystems.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5" data-testid="deps-ecosystems">
              {(["all", ...ecosystems] as const).map((e) => (
                <button key={e} type="button" className={cn("chip !py-0.5 text-xs", ecosystem === e && "chip-active")} onClick={() => setEcosystem(e)} aria-pressed={ecosystem === e}>
                  {e === "all" ? t("allEcosystems") : e}
                </button>
              ))}
            </div>
          )}
          {(c.outdated > 0 || c.vulnerable > 0) && !otherBranch && <p className="mb-3 text-xs text-muted">{t("tasksHint")}</p>}
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
                      <tr key={`${p.ecosystem ?? "npm"}:${p.name}`} data-testid="dep" data-ecosystem={p.ecosystem ?? "npm"}>
                        <td className="py-1.5 pr-3">
                          <a href={packageUrl(p.ecosystem, p.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-xs hover:text-accent-ink">
                            {p.name} <ExternalLink size={10} />
                          </a>
                          {ecosystems.length > 1 && <span className="ml-1.5 rounded bg-fg/10 px-1 text-[10px] text-muted">{p.ecosystem ?? "npm"}</span>}
                          {p.dev && <span className="ml-1.5 text-[10px] text-muted">{t("dev")}</span>}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-xs text-muted" title={p.manifest}>{p.range}</td>
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
