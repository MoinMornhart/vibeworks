"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Recurrence, TaskStatus } from "@prisma/client";
import { AlignLeft, Check, ListChecks, Plus, Repeat, SlidersHorizontal } from "lucide-react";
import { SortableColumns } from "@/components/ui/SortableColumns";
import type { TaskItem } from "@/lib/tasks";
import { dueState, formatDue, recurrenceLabel, type DueState } from "@/lib/taskDates";
import { TASK_STATUSES } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { cn, dayKey } from "@/lib/utils";
import { TaskDialog, type TaskForm } from "./TaskDialog";

const COLUMN_COLOR: Record<TaskStatus, string> = {
  TODO: "var(--vw-muted)",
  DOING: "var(--vw-accent)",
  BLOCKED: "#f87171",
  DONE: "#34d399",
};

const DUE_CLASS: Record<DueState, string> = {
  overdue: "border-red-500/40 bg-red-500/10 text-red-400",
  today: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  soon: "border-accent/40 bg-accent/10 text-accent-ink",
  later: "text-muted",
};

export function DueBadge({ dueDate, done, today }: { dueDate: string; done: boolean; today: string }) {
  const state = dueState(dueDate, today);
  return (
    <span suppressHydrationWarning className={cn("inline-flex items-center rounded-md border px-1.5 py-px text-[11px]", done ? "text-muted" : DUE_CLASS[state])} title={`Fällig am ${dueDate.split("-").reverse().join(".")}`}>
      {formatDue(dueDate, today)}
    </span>
  );
}

function TaskCard({
  task: t,
  handle,
  overlay,
  today,
  onOpen,
  onToggle,
}: {
  task: TaskItem;
  handle?: ReactNode;
  overlay?: boolean;
  today: string;
  onOpen: (t: TaskItem) => void;
  onToggle: (t: TaskItem) => void;
}) {
  const done = t.status === "DONE";
  return (
    <article className={cn("glass group !rounded-xl p-2.5", done && "opacity-75", overlay && "rotate-1 shadow-2xl ring-2 ring-accent/60")}>
      <div className="flex items-start gap-1">
        {handle}
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `${t.title} wieder öffnen` : `${t.title} erledigen`}
          onClick={() => onToggle(t)}
          className={cn(
            "mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition",
            done ? "border-emerald-400 bg-emerald-400 text-black" : "hover:border-emerald-400",
          )}
        >
          {done && <Check size={12} strokeWidth={3} />}
        </button>
        <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 px-1.5 pt-0.5 text-left text-sm leading-snug">
          <span className={cn("break-words", done && "text-muted line-through")}>{t.title}</span>
        </button>
      </div>
      {(t.dueDate || t.recurrence || t.description || t.labels.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[3.25rem] text-muted">
          {t.dueDate && <DueBadge dueDate={t.dueDate} done={done} today={today} />}
          {t.recurrence && <Repeat size={12} aria-label={recurrenceLabel(t.recurrence)} />}
          {t.description && <AlignLeft size={12} aria-label="Hat eine Beschreibung" />}
          {t.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded-md bg-fg/10 px-1.5 text-[11px]">{l}</span>
          ))}
        </div>
      )}
    </article>
  );
}

/** Was an PATCH /api/tasks/:id geht – recurrence null heißt „Wiederholung entfernen“. */
type TaskPatch = Partial<Omit<TaskForm, "recurrence">> & { recurrence?: Recurrence | null };

const byPosition = (a: TaskItem, b: TaskItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);
const statusOf = (t: TaskItem) => t.status;

export function TaskBoard({
  projectId,
  initial,
  limit,
  progressFromTasks,
}: {
  projectId: string;
  initial: TaskItem[];
  limit: number;
  progressFromTasks: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [dialog, setDialog] = useState<{ task: TaskItem | null; status: TaskStatus } | null>(null);
  const [quick, setQuick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = dayKey(new Date());
  const done = useMemo(() => tasks.filter((t) => t.status === "DONE").length, [tasks]);

  // Mit abgeleitetem Fortschritt ändert jede Aufgabe auch den Projektkopf.
  const afterChange = () => {
    if (progressFromTasks) router.refresh();
  };
  const merge = (list: Array<TaskItem | null | undefined>) =>
    setTasks((ts) => {
      let next = [...ts];
      for (const t of list) {
        if (!t) continue;
        next = next.some((x) => x.id === t.id) ? next.map((x) => (x.id === t.id ? t : x)) : [...next, t];
      }
      return next;
    });

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    setError(null);
    try {
      const res = await api<{ task: TaskItem }>(`/api/projects/${projectId}/tasks`, { body: { title } });
      merge([res.task]);
      afterChange();
    } catch (err) {
      setQuick(title);
      setError(errorMessage(err));
    }
  }

  async function patch(t: TaskItem, data: TaskPatch) {
    const before = tasks;
    if (data.status) setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: data.status!, position: 1e9 } : x)));
    setError(null);
    try {
      const res = await api<{ task: TaskItem; spawned: TaskItem | null }>(`/api/tasks/${t.id}`, { method: "PATCH", body: data });
      merge([res.task, res.spawned]);
      afterChange();
    } catch (err) {
      setTasks(before);
      throw err;
    }
  }

  function reorder(status: string, ids: string[]) {
    const before = tasks;
    setTasks((ts) =>
      ts.map((t) => {
        const i = ids.indexOf(t.id);
        return i >= 0 ? { ...t, status: status as TaskStatus, position: i, doneAt: status === "DONE" ? t.doneAt ?? new Date().toISOString() : null } : t;
      }),
    );
    setError(null);
    api<{ spawned: TaskItem[] }>(`/api/projects/${projectId}/tasks/reorder`, { method: "PATCH", body: { status, ids } })
      .then((res) => {
        merge(res.spawned);
        afterChange();
      })
      .catch((err) => {
        setTasks(before);
        setError(errorMessage(err));
      });
  }

  async function save(form: TaskForm) {
    const body = { ...form, recurrence: form.recurrence || null };
    if (dialog?.task) {
      await patch(dialog.task, body);
    } else {
      const res = await api<{ task: TaskItem }>(`/api/projects/${projectId}/tasks`, { body });
      merge([res.task]);
      afterChange();
    }
  }

  async function remove(t: TaskItem) {
    await api(`/api/tasks/${t.id}`, { method: "DELETE" });
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    afterChange();
  }

  const toggle = (t: TaskItem) => void patch(t, { status: t.status === "DONE" ? "TODO" : "DONE" }).catch((e) => setError(errorMessage(e)));
  const open = (t: TaskItem) => setDialog({ task: t, status: t.status });

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="tasks-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="tasks-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks size={18} className="text-accent-ink" /> Aufgaben
          {tasks.length > 0 && (
            <span className="rounded-full bg-fg/10 px-2 text-xs font-normal tabular-nums text-muted">{done}/{tasks.length} erledigt</span>
          )}
        </h2>
        <form onSubmit={quickAdd} className="flex w-full gap-2 sm:w-auto">
          <input className="field sm:w-72" placeholder="Neue Aufgabe … (Enter)" value={quick} onChange={(e) => setQuick(e.target.value)} maxLength={200} aria-label="Neue Aufgabe" />
          <button type="submit" className="btn btn-icon shrink-0" aria-label="Aufgabe anlegen" disabled={!quick.trim()}><Plus size={16} /></button>
          <button type="button" className="btn btn-icon shrink-0" aria-label="Aufgabe mit Details anlegen" title="Mit Details" onClick={() => setDialog({ task: null, status: "TODO" })}>
            <SlidersHorizontal size={15} />
          </button>
        </form>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <SortableColumns
        items={tasks}
        columns={TASK_STATUSES.map((s) => s.value)}
        columnOf={statusOf}
        sort={byPosition}
        labelOf={(t) => t.title}
        onReorder={reorder}
        limit={limit}
        emptyText="Keine Aufgaben"
        renderCard={(t, handle) => <TaskCard task={t} handle={handle} today={today} onOpen={open} onToggle={toggle} />}
        renderOverlay={(t) => <TaskCard task={t} overlay today={today} onOpen={open} onToggle={toggle} />}
        renderColumn={(status, count, body) => {
          const meta = TASK_STATUSES.find((s) => s.value === status)!;
          return (
            <div className="flex min-w-0 flex-col rounded-2xl border bg-bg/25 p-2.5" aria-label={meta.label} role="group">
              <h3 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLOR[status as TaskStatus] }} />
                {meta.label}
                <span className="ml-auto text-xs font-normal tabular-nums text-muted">{count}</span>
              </h3>
              {body}
            </div>
          );
        }}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      />

      <TaskDialog
        open={dialog !== null}
        task={dialog?.task ?? null}
        defaultStatus={dialog?.status}
        onClose={() => setDialog(null)}
        onSave={save}
        onDelete={remove}
      />
    </section>
  );
}
