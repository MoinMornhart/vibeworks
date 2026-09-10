"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListChecks, Pencil, Star, StickyNote } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { cn, timeAgo } from "@/lib/utils";
import { accentGradient, PriorityBadge, ProgressBar } from "./ProjectCard";

type Columns = Record<string, string[]>;

interface Handlers {
  onFavorite: (p: ProjectListItem) => void;
  onEdit: (p: ProjectListItem) => void;
}

function KanbanCard({ project: p, handle, overlay, onFavorite, onEdit }: { project: ProjectListItem; handle?: ReactNode; overlay?: boolean } & Handlers) {
  return (
    <article className={cn("glass group relative !rounded-xl p-3", overlay && "rotate-1 shadow-2xl ring-2 ring-accent/60")}>
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: accentGradient(p.accent, "180deg") }} />
      <div className="flex items-start gap-1 pl-1">
        {handle}
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 pt-0.5 font-medium leading-snug hover:text-accent-ink">
          <span className="line-clamp-2 break-words">{p.name}</span>
        </Link>
        <button onClick={() => onEdit(p)} className="rounded p-1 text-muted opacity-0 transition hover:text-fg group-hover:opacity-100 focus:opacity-100" aria-label={`${p.name} bearbeiten`}>
          <Pencil size={13} />
        </button>
        <button onClick={() => onFavorite(p)} aria-pressed={p.favorite} aria-label={p.favorite ? "Favorit entfernen" : "Als Favorit markieren"} className="rounded p-1">
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
        {p.tasks > 0 && <span className="inline-flex items-center gap-1"><ListChecks size={12} />{p.tasks}</span>}
        {p.notes > 0 && <span className="inline-flex items-center gap-1"><StickyNote size={12} />{p.notes}</span>}
        <span suppressHydrationWarning className="ml-auto truncate">{timeAgo(p.updatedAt)}</span>
      </div>
    </article>
  );
}

function SortableCard({ project, ...handlers }: { project: ProjectListItem } & Handlers) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && "opacity-30")}>
      <KanbanCard
        project={project}
        {...handlers}
        handle={
          // Gezogen wird nur am Griff – der Titel bleibt ein normaler Link.
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`${project.name} verschieben`}
            className="cursor-grab touch-none rounded p-1 text-muted hover:text-fg active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </div>
  );
}

function Column({ status, ids, byId, ...handlers }: { status: ProjectStatus; ids: string[]; byId: Map<string, ProjectListItem> } & Handlers) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = PROJECT_STATUS_MAP[status];
  return (
    <section className="glass flex w-[17.5rem] shrink-0 snap-start flex-col !rounded-2xl p-3 sm:w-80" aria-label={meta.label}>
      <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${meta.cssVar})` }} />
        {meta.label}
        <span className="ml-auto rounded-full bg-fg/10 px-2 text-xs font-normal tabular-nums text-muted">{ids.length}</span>
      </h2>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn("flex min-h-28 flex-1 flex-col gap-2.5 rounded-xl p-0.5 transition-colors", isOver && "bg-accent/10")}>
          {ids.map((id) => {
            const p = byId.get(id);
            return p ? <SortableCard key={id} project={p} {...handlers} /> : null;
          })}
          {ids.length === 0 && (
            <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed py-6 text-xs text-muted">Hierher ziehen</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function KanbanBoard({
  projects,
  statuses,
  onReorder,
  ...handlers
}: {
  projects: ProjectListItem[];
  statuses: ProjectStatus[];
  onReorder: (status: ProjectStatus, ids: string[]) => void;
} & Handlers) {
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const derive = useCallback((): Columns => {
    const cols: Columns = Object.fromEntries(statuses.map((s) => [s, [] as string[]]));
    const sorted = [...projects].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    for (const p of sorted) cols[p.status]?.push(p.id);
    return cols;
  }, [projects, statuses]);

  const [columns, setColumns] = useState<Columns>(derive);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Während des Ziehens gehört die Anordnung dem Brett, danach wieder den Daten.
  useEffect(() => {
    if (!activeId) setColumns(derive());
  }, [derive, activeId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: string) => (id in columns ? id : Object.keys(columns).find((k) => columns[k].includes(id)));

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = String(active.id);
    const from = findContainer(id);
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const toItems = [...cols[to]];
      const overIndex = toItems.indexOf(String(over.id));
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, id);
      return { ...cols, [from]: cols[from].filter((x) => x !== id), [to]: toItems };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const to = over ? findContainer(String(over.id)) : undefined;
    if (!to) {
      setActiveId(null);
      return;
    }
    let order = columns[to];
    const oldIndex = order.indexOf(id);
    const newIndex = order.indexOf(String(over!.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) order = arrayMove(order, oldIndex, newIndex);
    const original = derive()[to] ?? [];
    const changed = byId.get(id)?.status !== to || order.join() !== original.join();
    setColumns((cols) => ({ ...cols, [to]: order }));
    setActiveId(null);
    if (changed) onReorder(to as ProjectStatus, order);
  }

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: "Leertaste zum Aufnehmen, Pfeiltasten zum Verschieben, Leertaste zum Ablegen, Escape zum Abbrechen." },
      }}
    >
      <div className="-mx-3 flex snap-x gap-4 overflow-x-auto px-3 pb-4 sm:-mx-5 sm:px-5">
        {statuses.map((s) => (
          <Column key={s} status={s} ids={columns[s] ?? []} byId={byId} {...handlers} />
        ))}
      </div>
      <DragOverlay>{active ? <KanbanCard project={active} overlay {...handlers} /> : null}</DragOverlay>
    </DndContext>
  );
}
