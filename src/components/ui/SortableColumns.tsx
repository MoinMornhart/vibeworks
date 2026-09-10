"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// Spalten mit ziehbaren Karten – gemeinsame Grundlage für das Projekt-Kanban
// und das Aufgabenbrett. Gezogen wird nur am Griff, damit Klicks auf die
// Karte (Link, Dialog) weiter funktionieren. Nach dem Ablegen bekommt
// onReorder die vollständige Reihenfolge der Zielspalte.

type Columns = Record<string, string[]>;

// Maßgeblich ist, wo der Zeiger steht – nicht, wohin die gezogene Karte
// ragt. Der Griff sitzt links; mit Kartenecken als Maßstab landete eine
// über der Spaltenmitte losgelassene Karte sonst in der Nachbarspalte.
// Ohne Zeiger (Tastatur) greifen wieder die Kartenecken.
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

export interface SortableColumnsProps<T extends { id: string }> {
  columns: string[];
  items: T[];
  columnOf: (item: T) => string;
  sort: (a: T, b: T) => number;
  labelOf: (item: T) => string;
  onReorder: (column: string, ids: string[]) => void;
  renderCard: (item: T, handle: ReactNode) => ReactNode;
  renderOverlay: (item: T) => ReactNode;
  renderColumn: (column: string, count: number, body: ReactNode) => ReactNode;
  /** Höchstzahl sichtbarer Karten je Spalte (0 = alle). Begrenzt nur die
   *  Anzeige – zum Server geht immer die ganze Spalte. */
  limit?: number;
  emptyText?: string;
  className?: string;
}

function SortableItem({ id, label, render }: { id: string; label: string; render: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${label} verschieben`}
      className="cursor-grab touch-none rounded p-1 text-muted hover:text-fg active:cursor-grabbing"
    >
      <GripVertical size={16} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && "opacity-30")}>
      {render(handle)}
    </div>
  );
}

function DropArea({ id, items, children }: { id: string; items: string[]; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={cn("flex min-h-28 flex-1 flex-col gap-2.5 rounded-xl p-0.5 transition-colors", isOver && "bg-accent/10")}>
        {children}
      </div>
    </SortableContext>
  );
}

export function SortableColumns<T extends { id: string }>({
  columns: columnKeys,
  items,
  columnOf,
  sort,
  labelOf,
  onReorder,
  renderCard,
  renderOverlay,
  renderColumn,
  limit = 0,
  emptyText = "Hierher ziehen",
  className,
}: SortableColumnsProps<T>) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // Funktionen über eine Ref, damit neue Funktions-Instanzen je Render die
  // Spalten nicht ständig neu ableiten.
  const fns = useRef({ columnOf, sort });
  fns.current = { columnOf, sort };
  const keysJoined = columnKeys.join("|");

  const derive = useCallback((): Columns => {
    const cols: Columns = Object.fromEntries(keysJoined.split("|").map((c) => [c, [] as string[]]));
    for (const it of [...items].sort(fns.current.sort)) cols[fns.current.columnOf(it)]?.push(it.id);
    return cols;
  }, [items, keysJoined]);

  const [columns, setColumns] = useState<Columns>(derive);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    if (!to || !over) {
      setActiveId(null);
      return;
    }
    let order = columns[to];
    const oldIndex = order.indexOf(id);
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) order = arrayMove(order, oldIndex, newIndex);
    const item = byId.get(id);
    const changed = (item && columnOf(item) !== to) || order.join() !== (derive()[to] ?? []).join();
    setColumns((cols) => ({ ...cols, [to]: order }));
    setActiveId(null);
    if (changed) onReorder(to, order);
  }

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerFirst}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Leertaste zum Aufnehmen, Pfeiltasten zum Verschieben, Leertaste zum Ablegen, Escape zum Abbrechen.",
        },
      }}
    >
      <div className={className}>
        {columnKeys.map((c) => {
          const ids = columns[c] ?? [];
          let visible = limit > 0 && !expanded.has(c) ? ids.slice(0, limit) : ids;
          if (activeId && ids.includes(activeId) && !visible.includes(activeId)) visible = [...visible, activeId];
          const hidden = ids.length - visible.length;
          const body = (
            <DropArea id={c} items={visible}>
              {visible.map((id) => {
                const it = byId.get(id);
                return it ? <SortableItem key={id} id={id} label={labelOf(it)} render={(h) => renderCard(it, h)} /> : null;
              })}
              {ids.length === 0 && (
                <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed py-6 text-xs text-muted">{emptyText}</p>
              )}
              {hidden > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((s) => new Set(s).add(c))}>
                  {hidden} weitere anzeigen
                </button>
              )}
            </DropArea>
          );
          return <Fragment key={c}>{renderColumn(c, ids.length, body)}</Fragment>;
        })}
      </div>
      <DragOverlay>{active ? renderOverlay(active) : null}</DragOverlay>
    </DndContext>
  );
}
