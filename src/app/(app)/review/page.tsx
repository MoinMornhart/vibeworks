import Link from "next/link";
import { ArrowRightLeft, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, FolderPlus, GitCommitHorizontal, History, ListPlus } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { loadWeek } from "@/lib/review";
import { addDaysKey, isoWeek, mondayOf, zonedMidnight } from "@/lib/weeks";
import { dayKeyToDate, dueState, formatDue, isDayKey } from "@/lib/taskDates";
import { PROJECT_ACCENTS } from "@/lib/status";
import { cn, dayKey } from "@/lib/utils";
import { Feed } from "@/components/review/Feed";
import { ActivityHeatmap } from "@/components/review/ActivityHeatmap";
import { loadActivityStats } from "@/lib/activityStats";
import { secondsByProject } from "@/lib/timeServer";
import { WeekTime } from "@/components/time/WeekTime";

export const dynamic = "force-dynamic";

/** So viele Ereignisse zeigt der Rückblick selbst – alles Weitere die Zeitleiste. */
const FEED_PREVIEW = 40;

export async function generateMetadata() {
  const t = await getT("review");
  return { title: t("review.title") };
}

function Dot({ accent }: { accent: string }) {
  const a = PROJECT_ACCENTS[accent] ?? PROJECT_ACCENTS.violet;
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }} />;
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requirePageUser();
  const [{ week }, locale, t] = await Promise.all([searchParams, getLocale(), getT("review")]);
  const today = dayKey(new Date());
  const current = mondayOf(today);
  const monday = week && isDayKey(week) ? mondayOf(week) : current;
  const [data, activity, weekTime, tm] = await Promise.all([
    loadWeek(user.id, locale, zonedMidnight(monday), zonedMidnight(addDaysKey(monday, 7)), today),
    loadActivityStats(user.id, today),
    secondsByProject(user.id, zonedMidnight(monday), zonedMidnight(addDaysKey(monday, 7))),
    getT("time"),
  ]);

  const range = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", timeZone: "UTC" });
  const prev = addDaysKey(monday, -7);
  const next = monday < current ? addDaysKey(monday, 7) : null;
  const stats = [
    { icon: CheckCircle2, label: t("review.stats.done"), value: data.stats.done, tone: "text-emerald-400" },
    { icon: ListPlus, label: t("review.stats.created"), value: data.stats.created, tone: "text-accent-ink" },
    { icon: FolderPlus, label: t("review.stats.projects"), value: data.stats.projects, tone: "text-accent-ink" },
    { icon: GitCommitHorizontal, label: t("review.stats.commits"), value: data.stats.commits, tone: "text-fuchsia-400" },
    { icon: ArrowRightLeft, label: t("review.stats.status"), value: data.stats.status, tone: "text-sky-400" },
  ];
  const maxActive = Math.max(1, ...data.active.map((a) => a.count));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent-ink">{t("review.week", { n: isoWeek(monday) })}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t("review.title")}</h1>
          <p className="mt-1 text-muted">
            {t("review.range", { from: range.format(dayKeyToDate(monday)), to: range.format(dayKeyToDate(addDaysKey(monday, 6))) })}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label={t("review.weekNav")}>
          <Link href={`/review?week=${prev}`} className="btn btn-sm"><ChevronLeft size={15} /> {t("review.prev")}</Link>
          {monday !== current && <Link href="/review" className="btn btn-sm">{t("review.thisWeek")}</Link>}
          {next && <Link href={`/review?week=${next}`} className="btn btn-sm">{t("review.next")} <ChevronRight size={15} /></Link>}
          <Link href="/timeline" className="btn btn-sm"><History size={15} /> {t("review.fullTimeline")}</Link>
        </nav>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="glass flex items-center gap-3 p-4">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fg/5", s.tone)}><s.icon size={19} /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums">{s.value}</p>
              <p className="mt-1 truncate text-xs text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <ActivityHeatmap stats={activity} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass p-6" aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold"><CheckCircle2 size={18} className="text-emerald-400" /> {t("review.doneTitle")}</h2>
          {data.doneByProject.length === 0 ? (
            <p className="text-sm text-muted">{t("review.doneEmpty")}</p>
          ) : (
            <div className="space-y-4">
              {data.doneByProject.map((g) => (
                <div key={g.id}>
                  <Link href={`/projects/${g.id}`} className="mb-1.5 inline-flex items-center gap-2 text-sm font-medium hover:text-accent-ink">
                    <Dot accent={g.accent} /> {g.name} <span className="font-normal text-muted">{g.tasks.length}</span>
                  </Link>
                  <ul className="space-y-1 pl-4">
                    {g.tasks.map((task) => (
                      <li key={task.id} className="flex items-start gap-2 text-sm text-muted"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" /> <span className="break-words">{task.title}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="glass p-6" aria-labelledby="next-heading">
            <h2 id="next-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold"><CalendarClock size={18} className="text-amber-400" /> {t("review.nextTitle")}</h2>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted">{t("review.nextEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming.map((u) => {
                  const state = dueState(u.dueKey, today);
                  return (
                    <li key={u.id} className="flex items-start gap-2 text-sm">
                      <Dot accent={u.project.accent} />
                      <Link href={`/projects/${u.project.id}`} className="min-w-0 flex-1 break-words hover:text-accent-ink">
                        {u.title} <span className="text-muted">· {u.project.name}</span>
                      </Link>
                      <span className={cn("shrink-0 rounded-md border px-1.5 text-[11px]", state === "overdue" ? "border-red-500/40 bg-red-500/10 text-red-400" : state === "today" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "text-muted")}>
                        {formatDue(u.dueKey, today, locale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <WeekTime rows={weekTime} t={tm} />

          <section className="glass p-6" aria-labelledby="active-heading">
            <h2 id="active-heading" className="mb-4 text-lg font-semibold">{t("review.activeTitle")}</h2>
            {data.active.length === 0 ? (
              <p className="text-sm text-muted">{t("review.activeEmpty")}</p>
            ) : (
              <ul className="space-y-3">
                {data.active.map((a) => {
                  const accent = PROJECT_ACCENTS[a.accent] ?? PROJECT_ACCENTS.violet;
                  return (
                    <li key={a.id}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <Link href={`/projects/${a.id}`} className="truncate hover:text-accent-ink">{a.name}</Link>
                        <span className="shrink-0 text-xs text-muted tabular-nums">{t("review.events", { n: a.count })}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
                        <div className="h-full rounded-full" style={{ width: `${(a.count / maxActive) * 100}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="glass p-6" aria-labelledby="week-feed">
        <h2 id="week-feed" className="mb-4 flex items-center gap-2 text-lg font-semibold"><History size={18} className="text-accent-ink" /> {t("review.weekTimeline")}</h2>
        {/* Nur die neuesten Ereignisse – der Rest steht in der Zeitleiste */}
        <Feed items={data.feed.slice(0, FEED_PREVIEW)} locale={locale} />
        {data.feed.length > FEED_PREVIEW && (
          <div className="mt-6 text-center">
            <Link href="/timeline" className="btn btn-sm"><History size={15} /> {t("review.moreInTimeline", { n: data.feed.length })}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
