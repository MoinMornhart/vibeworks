"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { ListChecks, Pencil, Star, StickyNote } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { SortableColumns } from "@/components/ui/SortableColumns";
import { accentGradient, PriorityBadge, ProgressBar } from "./ProjectCard";

interface Handlers {
  onFavorite: (p: ProjectListItem) => void;
  onEdit: (p: ProjectListItem) => void;
}

function KanbanCard({ project: p, handle, overlay, onFavorite, onEdit }: { project: ProjectListItem; handle?: ReactNode; overlay?: boolean } & Handlers) {
  const t = useT("projects");
  const f = useFormat();
  return (
    <article className={cn("glass group relative !rounded-xl p-3", overlay && "rotate-1 shadow-2xl ring-2 ring-accent/60")}>
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: accentGradient(p.accent, "180deg") }} />
      <div className="flex items-start gap-1 pl-1">
        {handle}
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 pt-0.5 font-medium leading-snug hover:text-accent-ink">
          <span className="line-clamp-2 break-words">{p.name}</span>
        </Link>
        <button onClick={() => onEdit(p)} className="rounded p-1 text-muted opacity-0 transition hover:text-fg group-hover:opacity-100 focus:opacity-100" aria-label={t("card.editName", { name: p.name })}>
          <Pencil size={13} />
        </button>
        <button onClick={() => onFavorite(p)} aria-pressed={p.favorite} aria-label={p.favorite ? t("card.favoriteRemove") : t("card.favoriteAdd")} className="rounded p-1">
          <Star size={14} className={p.favorite ? "fill-amber-400 text-amber-400" : "text-muted"} />
        </button>
      </div>
      {p.summary && <p className="mt-1 line-clamp-2 pl-8 text-xs text-muted">{p.summary}</p>}
      <div className="mt-2.5 flex items-center gap-2 pl-8">
        <ProgressBar value={p.progress} accent={p.accent} className="flex-1" />
        <span className="w-8 text-right text-[11px] tabular-nums text-muted">{p.progress}%</span>
      </div>
      <div className="mt-2 flex items-center gap-2.5 pl-8 text-[11px] text-muted">
        <PriorityBadge priority={p.priority} compact />
        {p.tasks > 0 && <span className="inline-flex items-center gap-1" title={t("card.tasksDone")}><ListChecks size={12} />{p.tasksDone}/{p.tasks}</span>}
        {p.notes > 0 && <span className="inline-flex items-center gap-1"><StickyNote size={12} />{p.notes}</span>}
        <span suppressHydrationWarning className="ml-auto truncate">{f.ago(p.updatedAt)}</span>
      </div>
    </article>
  );
}

const byPosition = (a: ProjectListItem, b: ProjectListItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);
const statusOf = (p: ProjectListItem) => p.status;

export function KanbanBoard({
  projects,
  statuses,
  onReorder,
  onFavorite,
  onEdit,
}: {
  projects: ProjectListItem[];
  statuses: ProjectStatus[];
  onReorder: (status: ProjectStatus, ids: string[]) => void;
} & Handlers) {
  const ts = useT("status");
  return (
    <SortableColumns
      items={projects}
      columns={statuses}
      columnOf={statusOf}
      sort={byPosition}
      labelOf={(p) => p.name}
      onReorder={(c, ids) => onReorder(c as ProjectStatus, ids)}
      renderCard={(p, handle) => <KanbanCard project={p} handle={handle} onFavorite={onFavorite} onEdit={onEdit} />}
      renderOverlay={(p) => <KanbanCard project={p} overlay onFavorite={onFavorite} onEdit={onEdit} />}
      renderColumn={(status, count, body) => {
        const meta = PROJECT_STATUS_MAP[status as ProjectStatus];
        const label = ts(`project.${status as ProjectStatus}`);
        return (
          <section className="glass flex w-[17.5rem] shrink-0 snap-start flex-col !rounded-2xl p-3 sm:w-80" aria-label={label}>
            <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${meta.cssVar})` }} />
              {label}
              <span className="ml-auto rounded-full bg-fg/10 px-2 text-xs font-normal tabular-nums text-muted">{count}</span>
            </h2>
            {body}
          </section>
        );
      }}
      className="-mx-3 flex snap-x gap-4 overflow-x-auto px-3 pb-4 sm:-mx-5 sm:px-5"
    />
  );
}
