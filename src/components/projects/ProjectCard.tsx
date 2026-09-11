"use client";

import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { ArrowDown, ArrowUp, Check, Flame, GitBranch, ListChecks, Pencil, Star, StickyNote } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { StatusSelect } from "./StatusSelect";
import type { CiState } from "@/lib/git/ci";

// Farbe des CI-Punkts auf der Karte
const CI_DOT: Record<CiState, string> = {
  success: "bg-emerald-400",
  failure: "bg-red-400",
  running: "bg-amber-400 animate-pulse",
  pending: "bg-amber-400",
  canceled: "bg-fg/30",
};

export function accentGradient(accent: string, dir = "90deg"): string {
  const a = PROJECT_ACCENTS[accent] ?? PROJECT_ACCENTS.violet;
  return `linear-gradient(${dir}, ${a.from}, ${a.to})`;
}

export function PriorityBadge({ priority, compact = false }: { priority: number; compact?: boolean }) {
  const t = useT("projects");
  const ts = useT("status");
  if (priority === 2) return null;
  const map = {
    1: { icon: ArrowDown, cls: "text-muted" },
    3: { icon: ArrowUp, cls: "text-amber-400" },
    4: { icon: Flame, cls: "text-red-400" },
  } as const;
  const p = map[priority as 1 | 3 | 4];
  if (!p) return null;
  const label = ts(`priority.${String(priority) as "1" | "3" | "4"}`);
  return (
    <span className={cn("inline-flex items-center gap-1", p.cls)} title={t("card.priority", { label })}>
      <p.icon size={13} />
      {!compact && label}
    </span>
  );
}

export function ProgressBar({ value, accent, className }: { value: number; accent: string; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-fg/10", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${value}%`, background: accentGradient(accent) }} />
    </div>
  );
}

interface CardProps {
  project: ProjectListItem;
  onStatus: (p: ProjectListItem, status: ProjectStatus) => void;
  onFavorite: (p: ProjectListItem) => void;
  onEdit: (p: ProjectListItem) => void;
  onSelect?: (p: ProjectListItem) => void;
  selected?: boolean;
  /** Ist schon etwas ausgewählt, stehen die Kästchen dauerhaft da. */
  selecting?: boolean;
  index?: number;
}

function SelectBox({ project, selected, selecting, onSelect }: Pick<CardProps, "project" | "selected" | "selecting" | "onSelect">) {
  const t = useT("projects");
  if (!onSelect) return null;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={Boolean(selected)}
      aria-label={t("card.selectName", { name: project.name })}
      onClick={() => onSelect(project)}
      className={cn(
        "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
        selected ? "border-accent bg-accent text-on-accent" : "bg-bg/40 hover:border-accent",
        !selected && !selecting && "opacity-0 group-hover:opacity-100 focus:opacity-100",
      )}
    >
      {selected && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

export function ProjectCard({ project: p, onStatus, onFavorite, onEdit, onSelect, selected, selecting, index = 0 }: CardProps) {
  const t = useT("projects");
  const f = useFormat();
  return (
    <article
      className={cn("glass lift fade-in group relative flex min-h-52 flex-col p-5 hover:z-10 focus-within:z-20", selected && "ring-2 ring-accent/60")}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.25rem]" style={{ background: accentGradient(p.accent) }} />
      <div className="flex items-start gap-1.5">
        <SelectBox project={p} selected={selected} selecting={selecting} onSelect={onSelect} />
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 text-lg font-semibold leading-snug hover:text-accent-ink">
          <span className="line-clamp-2 break-words">{p.name}</span>
        </Link>
        <button
          onClick={() => onEdit(p)}
          className="btn btn-ghost btn-icon btn-sm opacity-0 transition group-hover:opacity-100 focus:opacity-100"
          aria-label={t("card.editName", { name: p.name })}
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onFavorite(p)}
          aria-pressed={p.favorite}
          aria-label={p.favorite ? t("card.favoriteRemove") : t("card.favoriteAdd")}
          className="btn btn-ghost btn-icon btn-sm"
        >
          <Star size={16} className={p.favorite ? "fill-amber-400 text-amber-400" : "text-muted"} />
        </button>
      </div>

      {p.summary ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p>
      ) : (
        <p className="mt-1 text-sm italic text-muted opacity-70">{t("card.noSummary")}</p>
      )}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{t("card.progress")}</span>
          <span className="tabular-nums">{p.progress} %</span>
        </div>
        <ProgressBar value={p.progress} accent={p.accent} />
      </div>

      {p.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.tags.slice(0, 5).map((t) => (
            <span key={t} className="chip">#{t}</span>
          ))}
          {p.tags.length > 5 && <span className="chip">+{p.tags.length - 5}</span>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <div className="flex min-w-0 items-center gap-3 text-xs text-muted">
          <PriorityBadge priority={p.priority} compact />
          {p.tasks > 0 && (
            <span className="inline-flex items-center gap-1" title={t("card.tasks")}><ListChecks size={13} />{p.tasksDone}/{p.tasks}</span>
          )}
          {p.notes > 0 && (
            <span className="inline-flex items-center gap-1" title={t("card.notes")}><StickyNote size={13} />{p.notes}</span>
          )}
          {p.repoUrl && <GitBranch size={13} aria-label={t("card.repoLinked")} />}
          {p.ci && <span className={cn("h-2 w-2 shrink-0 rounded-full", CI_DOT[p.ci])} title={t(`card.ci.${p.ci}`)} role="img" aria-label={t(`card.ci.${p.ci}`)} />}
          <span suppressHydrationWarning className="truncate" title={t("card.lastUpdated")}>{f.ago(p.updatedAt)}</span>
        </div>
        <StatusSelect value={p.status} onChange={(s) => onStatus(p, s)} />
      </div>
    </article>
  );
}

export function ProjectRow({ project: p, onStatus, onFavorite, onEdit, onSelect, selected, selecting }: CardProps) {
  const t = useT("projects");
  const f = useFormat();
  return (
    <div className={cn("glass group relative flex items-center gap-3 !rounded-xl px-3 py-2.5 hover:z-10 focus-within:z-20 sm:px-4", selected && "ring-2 ring-accent/60")}>
      <SelectBox project={p} selected={selected} selecting={selecting} onSelect={onSelect} />
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: `var(${PROJECT_STATUS_MAP[p.status].cssVar})` }} aria-hidden />
      <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-medium hover:text-accent-ink">{p.name}</span>
        {p.summary && <span className="block truncate text-xs text-muted">{p.summary}</span>}
      </Link>
      <div className="hidden w-36 items-center gap-2 sm:flex">
        <ProgressBar value={p.progress} accent={p.accent} className="flex-1" />
        <span className="w-9 text-right text-xs tabular-nums text-muted">{p.progress}%</span>
      </div>
      <span className="hidden w-10 items-center gap-1 text-xs text-muted md:inline-flex" title={t("card.tasks")}><ListChecks size={13} />{p.tasksDone}/{p.tasks}</span>
      <span className="hidden w-10 items-center gap-1 text-xs text-muted md:inline-flex" title={t("card.notes")}><StickyNote size={13} />{p.notes}</span>
      <span className="hidden w-20 text-xs text-muted lg:inline"><PriorityBadge priority={p.priority} /></span>
      <span suppressHydrationWarning className="hidden w-28 truncate text-xs text-muted lg:inline">{f.ago(p.updatedAt)}</span>
      <button onClick={() => onEdit(p)} className="btn btn-ghost btn-icon btn-sm hidden sm:inline-flex" aria-label={t("card.editName", { name: p.name })}>
        <Pencil size={14} />
      </button>
      <button onClick={() => onFavorite(p)} aria-pressed={p.favorite} aria-label={p.favorite ? t("card.favoriteRemove") : t("card.favoriteAdd")} className="btn btn-ghost btn-icon btn-sm">
        <Star size={15} className={p.favorite ? "fill-amber-400 text-amber-400" : "text-muted"} />
      </button>
      <StatusSelect value={p.status} onChange={(s) => onStatus(p, s)} />
    </div>
  );
}
