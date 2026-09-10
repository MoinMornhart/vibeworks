"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { Check, CheckCheck, Repeat } from "lucide-react";
import type { TaskItem } from "@/lib/tasks";
import { BUCKETS, bucketOf, recurrenceLabel, type Bucket } from "@/lib/taskDates";
import { TASK_STATUSES } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { accentGradient } from "@/components/projects/ProjectCard";
import { DueBadge } from "./TaskBoard";
import { TaskDialog, type TaskForm } from "./TaskDialog";

type ProjectRef = { id: string; name: string; accent: string };
export type OverviewTask = TaskItem & { project: ProjectRef };

const STATUS_TONE: Record<TaskStatus, string> = {
  TODO: "text-muted",
  DOING: "text-accent-ink",
  BLOCKED: "text-red-400",
  DONE: "text-emerald-400",
};

const BUCKET_TONE: Partial<Record<Bucket, string>> = { overdue: "text-red-400", today: "text-amber-400" };

const byDue = (a: OverviewTask, b: OverviewTask) =>
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt.localeCompare(b.createdAt);

export function TaskOverview({ initial, today }: { initial: OverviewTask[]; today: string }) {
  const [tasks, setTasks] = useState(initial);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [editing, setEditing] = useState<OverviewTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo(() => {
    const map = new Map<string, ProjectRef>();
    for (const t of tasks) map.set(t.project.id, t.project);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [tasks]);

  const inProject = useMemo(() => tasks.filter((t) => !projectId || t.project.id === projectId), [tasks, projectId]);
  const counts = useMemo(() => {
    const c: Partial<Record<TaskStatus, number>> = {};
    for (const t of inProject) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [inProject]);

  const visible = inProject.filter((t) => (showDone || t.status !== "DONE") && (!statuses.length || statuses.includes(t.status)));
  const groups = BUCKETS.map((b) => ({ ...b, items: visible.filter((t) => bucketOf(t.dueDate, today) === b.value).sort(byDue) }));

  function merge(list: Array<TaskItem | null | undefined>, project: ProjectRef) {
    setTasks((ts) => {
      let next = [...ts];
      for (const t of list) {
        if (!t) continue;
        const item = { ...t, project };
        next = next.some((x) => x.id === t.id) ? next.map((x) => (x.id === t.id ? item : x)) : [...next, item];
      }
      return next;
    });
  }

  async function patch(t: OverviewTask, body: object) {
    setError(null);
    const res = await api<{ task: TaskItem; spawned: TaskItem | null }>(`/api/tasks/${t.id}`, { method: "PATCH", body });
    merge([res.task, res.spawned], t.project);
  }

  // Abhaken direkt aus der Liste: Zeitpunkt, abgeleiteter Projektfortschritt
  // und bei wiederkehrenden Aufgaben die nächste Fassung erledigt der Server.
  function toggle(t: OverviewTask) {
    const status: TaskStatus = t.status === "DONE" ? "TODO" : "DONE";
    const before = tasks;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    patch(t, { status }).catch((e) => {
      setTasks(before);
      setError(errorMessage(e));
    });
  }

  const toggleStatus = (s: TaskStatus) => setStatuses((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const openCount = inProject.filter((t) => t.status !== "DONE").length;

  return (
    <div className="fade-in">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Aufgaben</h1>
        <p className="mt-1 text-muted">
          {openCount === 0 ? "Nichts offen – Zeit für die nächste Idee." : `${openCount} offen über ${projects.length} Projekt${projects.length === 1 ? "" : "e"}, nach Fälligkeit geordnet.`}
        </p>
      </header>

      <div className="glass mb-6 flex flex-wrap items-center gap-2 p-2">
        {TASK_STATUSES.filter((s) => s.value !== "DONE").map((s) => (
          <button key={s.value} className={cn("chip", statuses.includes(s.value) && "chip-active")} aria-pressed={statuses.includes(s.value)} onClick={() => toggleStatus(s.value)}>
            <span className={STATUS_TONE[s.value]}>●</span> {s.label} <span className="tabular-nums opacity-70">{counts[s.value] ?? 0}</span>
          </button>
        ))}
        <button className={cn("chip", showDone && "chip-active")} aria-pressed={showDone} onClick={() => setShowDone((v) => !v)}>
          <CheckCheck size={13} /> Erledigte zeigen <span className="tabular-nums opacity-70">{counts.DONE ?? 0}</span>
        </button>
        <select className="field ml-auto !w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Nach Projekt filtern">
          <option value="">Alle Projekte</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {visible.length === 0 ? (
        <div className="glass px-6 py-14 text-center">
          <p className="font-medium">Keine Aufgaben {statuses.length || projectId ? "für diesen Filter" : "offen"}</p>
          <p className="mt-1 text-sm text-muted">Aufgaben legst du auf der Seite des jeweiligen Projekts an.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <section key={g.value} aria-labelledby={`bucket-${g.value}`}>
                <h2 id={`bucket-${g.value}`} className={cn("mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider", BUCKET_TONE[g.value] ?? "text-muted")}>
                  {g.label} <span className="font-normal">{g.items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {g.items.map((t) => {
                    const done = t.status === "DONE";
                    return (
                      <li key={t.id} className={cn("glass flex items-center gap-3 !rounded-xl px-3 py-2.5", done && "opacity-70")}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={done}
                          aria-label={done ? `${t.title} wieder öffnen` : `${t.title} erledigen`}
                          onClick={() => toggle(t)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                            done ? "border-emerald-400 bg-emerald-400 text-black" : "hover:border-emerald-400",
                          )}
                        >
                          {done && <Check size={13} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setEditing(t)} className="block max-w-full truncate text-left text-sm hover:text-accent-ink">
                            <span className={cn(done && "text-muted line-through")}>{t.title}</span>
                          </button>
                          <Link href={`/projects/${t.project.id}`} className="mt-0.5 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted hover:text-fg">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accentGradient(t.project.accent) }} />
                            {t.project.name}
                          </Link>
                        </div>
                        <div className="hidden items-center gap-1.5 md:flex">
                          {t.labels.slice(0, 3).map((l) => (
                            <span key={l} className="rounded-md bg-fg/10 px-1.5 text-[11px] text-muted">{l}</span>
                          ))}
                        </div>
                        {t.recurrence && <Repeat size={14} className="shrink-0 text-muted" aria-label={recurrenceLabel(t.recurrence)} />}
                        <span className={cn("hidden w-20 shrink-0 text-right text-xs sm:inline", STATUS_TONE[t.status])}>
                          {TASK_STATUSES.find((s) => s.value === t.status)?.label}
                        </span>
                        <span className="w-24 shrink-0 text-right">{t.dueDate && <DueBadge dueDate={t.dueDate} done={done} today={today} />}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <TaskDialog
        open={editing !== null}
        task={editing}
        onClose={() => setEditing(null)}
        onSave={async (form: TaskForm) => {
          if (editing) await patch(editing, { ...form, recurrence: form.recurrence || null });
        }}
        onDelete={async (t) => {
          await api(`/api/tasks/${t.id}`, { method: "DELETE" });
          setTasks((ts) => ts.filter((x) => x.id !== t.id));
        }}
      />
    </div>
  );
}
