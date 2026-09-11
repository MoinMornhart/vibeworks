"use client";

import { useState } from "react";
import { ChevronDown, GitBranch, ListChecks, NotebookPen, Sparkles } from "lucide-react";
import type { ProgressAnalysis, ProgressPart } from "@/lib/progress";
import { useT } from "@/lib/i18n/client";

const CI_KEYS = ["success", "failure", "running", "pending", "canceled"] as const;
const ICON = { tasks: ListChecks, development: GitBranch, planning: NotebookPen };

/** „Wie berechnet?“ – die Bestandteile des automatischen Fortschritts. */
export function ProgressAnalysisView({ analysis }: { analysis: ProgressAnalysis }) {
  const t = useT("projects");
  const ts = useT("status");
  const [open, setOpen] = useState(false);
  const f = analysis.facts;
  const ci = (CI_KEYS as readonly string[]).includes(f.ci ?? "") ? (f.ci as (typeof CI_KEYS)[number]) : "none";

  const text = (p: ProgressPart) => {
    if (p.key === "tasks")
      return f.tasks.total
        ? t("dialog.progressAnalysis.tasks", { done: f.tasks.DONE, total: f.tasks.total, doing: f.tasks.DOING, blocked: f.tasks.BLOCKED })
        : t("dialog.progressAnalysis.noTasks");
    if (p.key === "development")
      return p.available ? t("dialog.progressAnalysis.development", { commits: f.commits ?? 0, ci: t(`dialog.progressAnalysis.ci.${ci}`) }) : t("dialog.progressAnalysis.noRepo");
    return t("dialog.progressAnalysis.planning", { description: t(`dialog.progressAnalysis.description.${f.description}`), notes: f.notes });
  };

  return (
    <div className="mt-2">
      <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Sparkles size={12} className="text-accent-ink" /> {t("dialog.progressAnalysis.badge")} · {open ? t("dialog.progressAnalysis.hide") : t("dialog.progressAnalysis.show")}
        <ChevronDown size={12} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-xl border p-3 text-sm" data-testid="progress-analysis">
          {analysis.parts.map((p) => {
            const Icon = ICON[p.key];
            return (
              <li key={p.key} className={p.available ? "flex items-start gap-2" : "flex items-start gap-2 text-muted"}>
                <Icon size={14} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">{text(p)}</span>
                {analysis.status !== "DONE" && p.available && (
                  <span className="shrink-0 tabular-nums text-accent-ink">{t("dialog.progressAnalysis.points", { n: p.points })}</span>
                )}
              </li>
            );
          })}
          {analysis.status === "DONE" && <li className="text-xs text-muted">{t("dialog.progressAnalysis.done")}</li>}
          {analysis.cappedAt !== null && (
            <li className="text-xs text-muted">{t("dialog.progressAnalysis.cap", { status: ts(`project.${analysis.status}`), max: analysis.cappedAt })}</li>
          )}
        </ul>
      )}
    </div>
  );
}
