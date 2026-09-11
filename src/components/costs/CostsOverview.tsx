"use client";

import Link from "next/link";
import { CalendarClock, Wallet } from "lucide-react";
import { accentGradient } from "@/components/projects/ProjectCard";
import { useLocale, useT } from "@/lib/i18n/client";
import { costTotals, formatMoney, nextRenewal, type CostItem } from "@/lib/costs";
import { diffDays } from "@/lib/taskDates";
import { CostTotalsLine, RenewalBadge } from "./CostPanel";

export type OverviewCost = CostItem & { project: { id: string; name: string; accent: string } };

const UPCOMING_DAYS = 60;

/** Kosten aller eigenen Projekte: Summen je Währung, anstehende Verlängerungen, je Projekt. */
export function CostsOverview({ costs, today }: { costs: OverviewCost[]; today: string }) {
  const t = useT("costs");
  const locale = useLocale();
  const totals = costTotals(costs);
  const upcoming = costs
    .filter((c) => c.interval !== "ONCE")
    .map((c) => ({ c, next: nextRenewal(c.renewsOn, c.interval, today) }))
    .filter((x): x is { c: OverviewCost; next: string } => x.next !== null && diffDays(today, x.next) <= UPCOMING_DAYS)
    .sort((a, b) => a.next.localeCompare(b.next));
  const groups = [...new Map(costs.map((c) => [c.project.id, c.project])).values()].map((p) => ({ project: p, items: costs.filter((c) => c.project.id === p.id) }));

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight"><Wallet size={26} className="text-emerald-400" /> {t("overview.title")}</h1>
        <p className="mt-1 text-muted">{t("overview.subtitle")}</p>
      </header>

      {costs.length === 0 ? (
        <div className="glass px-6 py-14 text-center text-muted">{t("overview.empty")}</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3" data-testid="cost-summary">
            {totals.map((x) => (
              <div key={x.currency} className="glass p-5">
                <p className="text-xs text-muted">{x.currency}</p>
                <p className="text-2xl font-bold tabular-nums">{formatMoney(x.monthly, x.currency, locale)} <span className="text-sm font-normal text-muted">{t("overview.monthly")}</span></p>
                <p className="text-sm text-muted tabular-nums">
                  {formatMoney(x.yearly, x.currency, locale)} {t("overview.yearly")}
                  {x.once ? ` · ${formatMoney(x.once, x.currency, locale)} ${t("overview.once")}` : ""}
                </p>
              </div>
            ))}
          </div>

          <section className="glass p-6" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold"><CalendarClock size={18} className="text-amber-400" /> {t("overview.upcoming")}</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">{t("overview.noUpcoming")}</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map(({ c }) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accentGradient(c.project.accent) }} />
                    <span className="min-w-0 flex-1 truncate">{c.name} <span className="text-muted">· {c.project.name}</span></span>
                    <RenewalBadge cost={c} today={today} />
                    <span className="tabular-nums">{formatMoney(c.amountCents, c.currency, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="by-project" className="space-y-3">
            <h2 id="by-project" className="text-sm font-semibold uppercase tracking-wider text-muted">{t("overview.projects")}</h2>
            {groups.map(({ project, items }) => (
              <div key={project.id} className="glass p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: accentGradient(project.accent) }} />
                  <Link href={`/projects/${project.id}`} className="font-semibold hover:text-accent-ink">{project.name}</Link>
                  <span className="ml-auto"><CostTotalsLine costs={items} /></span>
                </div>
                <ul className="space-y-1 text-sm">
                  {items.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-muted">{c.name}</span>
                      <span className="tabular-nums">{formatMoney(c.amountCents, c.currency, locale)} <span className="text-xs text-muted">{t(`intervals.${c.interval}`)}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
