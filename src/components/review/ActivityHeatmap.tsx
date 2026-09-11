"use client";

import { Flame, Trophy } from "lucide-react";
import type { ActivityStats } from "@/lib/activityStats";
import { heatLevel } from "@/lib/stats";
import { useFormat, useLocale, useT } from "@/lib/i18n/client";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const LEVEL = ["bg-fg/10", "bg-accent/30", "bg-accent/55", "bg-accent/80", "bg-accent"];

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** Aktivitätsgitter des letzten Jahres mit Serien – und darunter die Erfolge. */
export function ActivityHeatmap({ stats }: { stats: ActivityStats }) {
  const t = useT("stats");
  const f = useFormat();
  const locale = useLocale();
  const month = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: "UTC" });
  const unlocked = stats.achievements.filter((a) => a.done).length;

  return (
    <div className="space-y-6">
      <section className="glass min-w-0 p-6" aria-labelledby="activity-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="activity-heading" className="flex items-center gap-2 text-lg font-semibold"><Flame size={18} className="text-orange-400" /> {t("title")}</h2>
            <p className="text-sm text-muted">{t("subtitle")}</p>
          </div>
          <dl className="flex gap-6" data-testid="streaks">
            <Figure label={t("current")} value={t("days", { n: stats.current })} />
            <Figure label={t("longest")} value={t("days", { n: stats.longest })} />
            <Figure label={t("activeDays")} value={String(stats.activeDays)} />
          </dl>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]" role="img" aria-label={t("aria", { days: stats.activeDays, total: stats.total })}>
            <div className="mr-1 flex flex-col gap-[3px] pt-4 text-[10px] leading-3 text-muted">
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} className="h-3">{d % 2 === 0 ? weekday.format(Date.UTC(2024, 0, 1 + d)) : ""}</span>
              ))}
            </div>
            {stats.grid.weeks.map((week, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                <span className="h-4 whitespace-nowrap text-[10px] leading-4 text-muted">
                  {stats.grid.monthStarts[w] && week[0] ? month.format(new Date(`${week[0].day}T12:00:00Z`)) : ""}
                </span>
                {week.map((cell, d) =>
                  cell ? (
                    <span
                      key={d}
                      data-day={cell.day}
                      data-count={cell.count}
                      title={cell.count ? t("cell", { date: f.date(cell.day), n: cell.count }) : t("cellNone", { date: f.date(cell.day) })}
                      className={cn("h-3 w-3 rounded-[3px]", LEVEL[heatLevel(cell.count)])}
                    />
                  ) : (
                    <span key={d} className="h-3 w-3" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
          {t("less")} {LEVEL.map((c) => <span key={c} className={cn("h-3 w-3 rounded-[3px]", c)} />)} {t("more")}
        </div>
      </section>

      <section className="glass p-6" aria-labelledby="achievements-heading">
        <h2 id="achievements-heading" className="flex items-center gap-2 text-lg font-semibold"><Trophy size={18} className="text-amber-400" /> {t("achievements")}</h2>
        <p className="mb-4 text-sm text-muted">{t("unlocked", { n: unlocked, total: stats.achievements.length })}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.achievements.map((a) => (
            <li key={a.key} data-testid="achievement" data-done={a.done} className={cn("flex items-center gap-3 rounded-xl border p-2.5", !a.done && "opacity-55")}>
              <span className={cn("text-2xl", !a.done && "grayscale")} aria-hidden>{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t(`a.${a.key}.title`)}</p>
                <p className="truncate text-xs text-muted">{t(`a.${a.key}.text`, { n: a.target })}</p>
                {!a.done && a.target > 1 && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-fg/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(a.value / a.target) * 100}%` }} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
