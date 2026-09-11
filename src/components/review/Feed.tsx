import Link from "next/link";
import {
  ArrowRightLeft,
  CheckCircle2,
  FolderPlus,
  GitCommitHorizontal,
  ListPlus,
  ListTodo,
  Pencil,
  Share2,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { FeedItem } from "@/lib/review";
import type { FeedKind } from "@/lib/activityText";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/messages";
import { PROJECT_ACCENTS } from "@/lib/status";
import { dayKeyToDate } from "@/lib/taskDates";
import { addDaysKey } from "@/lib/weeks";
import { cn, dayKey, TIME_ZONE } from "@/lib/utils";

// Zeitleiste als Server-Komponente: nach Tagen gruppiert, neueste zuerst.

const ICONS: Record<FeedKind, { icon: LucideIcon; tone: string }> = {
  PROJECT_CREATED: { icon: FolderPlus, tone: "text-accent-ink bg-accent/15" },
  PROJECT_UPDATED: { icon: Pencil, tone: "text-muted bg-fg/10" },
  STATUS_CHANGED: { icon: ArrowRightLeft, tone: "text-sky-400 bg-sky-500/15" },
  TASK_ADDED: { icon: ListPlus, tone: "text-muted bg-fg/10" },
  TASK_MOVED: { icon: ListTodo, tone: "text-amber-400 bg-amber-500/15" },
  TASK_DONE: { icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-500/15" },
  TASK_DELETED: { icon: Trash2, tone: "text-red-400 bg-red-500/10" },
  NOTE_ADDED: { icon: StickyNote, tone: "text-muted bg-fg/10" },
  NOTE_UPDATED: { icon: StickyNote, tone: "text-muted bg-fg/10" },
  NOTE_DELETED: { icon: Trash2, tone: "text-red-400 bg-red-500/10" },
  SHARE: { icon: Share2, tone: "text-accent-ink bg-accent/15" },
  COMMIT: { icon: GitCommitHorizontal, tone: "text-fuchsia-400 bg-fuchsia-500/15" },
};

export function Feed({ items, locale }: { items: FeedItem[]; locale: Locale }) {
  const t = makeT(locale, "review");
  const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const today = dayKey(new Date());
  const yesterday = addDaysKey(today, -1);

  const groups: Array<{ day: string; items: FeedItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }

  if (!items.length) return <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted">{t("timeline.empty")}</p>;

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {g.day === today ? t("timeline.today") : g.day === yesterday ? t("timeline.yesterday") : dayFmt.format(dayKeyToDate(g.day))}
            <span className="h-px flex-1 bg-fg/10" />
            <span className="font-normal normal-case tabular-nums">{g.items.length}</span>
          </h3>
          <ol className="space-y-2">
            {g.items.map((item) => {
              const { icon: Icon, tone } = ICONS[item.kind];
              const accent = PROJECT_ACCENTS[item.accent] ?? PROJECT_ACCENTS.violet;
              return (
                <li key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-fg/[0.04]">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", tone)}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm leading-snug">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent-ink">{item.text}</a>
                      ) : (
                        item.text
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <Link href={`/projects/${item.projectId}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                        <span className="h-2 w-2 rounded-full" style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }} />
                        {item.projectName}
                      </Link>
                      <span aria-hidden>·</span>
                      <time dateTime={item.at}>{time.format(new Date(item.at))}</time>
                      {item.kind === "COMMIT" && <span className="rounded bg-fg/10 px-1 font-mono text-[10px]">{t("timeline.commit")}</span>}
                      {item.by && <span>{t("timeline.by", { name: item.by })}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
