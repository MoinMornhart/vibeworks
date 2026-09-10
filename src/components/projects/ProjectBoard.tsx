"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { Archive, FolderPlus, GitBranch, Hammer, LayoutGrid, Lightbulb, List, Plus, Rows3, Search, CircleCheck, Layers } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { ProjectCard, ProjectRow } from "./ProjectCard";
import { ProjectDialog } from "./ProjectDialog";

type View = "grid" | "list" | "grouped";
type Sort = "updated" | "created" | "name" | "progress" | "priority";

const SORTS: Array<{ value: Sort; label: string; cmp: (a: ProjectListItem, b: ProjectListItem) => number }> = [
  { value: "updated", label: "Zuletzt geändert", cmp: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  { value: "created", label: "Neueste zuerst", cmp: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { value: "name", label: "Name", cmp: (a, b) => a.name.localeCompare(b.name, "de") },
  { value: "progress", label: "Fortschritt", cmp: (a, b) => b.progress - a.progress },
  { value: "priority", label: "Priorität", cmp: (a, b) => b.priority - a.priority },
];

const VIEWS: Array<{ value: View; label: string; icon: typeof LayoutGrid }> = [
  { value: "grid", label: "Raster", icon: LayoutGrid },
  { value: "list", label: "Liste", icon: List },
  { value: "grouped", label: "Nach Status", icon: Rows3 },
];

const STORAGE_KEY = "vw.board";

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Layers; label: string; value: number | string; hint?: string }) {
  return (
    <div className="glass flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-ink">
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted">{label}{hint && <span className="hidden sm:inline"> · {hint}</span>}</p>
      </div>
    </div>
  );
}

export function ProjectBoard({ initial, greeting }: { initial: ProjectListItem[]; greeting: string }) {
  const [projects, setProjects] = useState(initial);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<View>("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ project: ProjectListItem | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ansicht, Sortierung und Archiv-Schalter überdauern das Neuladen – der
  // Suchbegriff bewusst nicht.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (VIEWS.some((v) => v.value === s.view)) setView(s.view);
      if (SORTS.some((x) => x.value === s.sort)) setSort(s.sort);
      if (typeof s.showArchived === "boolean") setShowArchived(s.showArchived);
    } catch {
      /* Speicher nicht verfügbar */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view, sort, showArchived }));
    } catch {
      /* egal */
    }
  }, [view, sort, showArchived]);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (showArchived || p.status !== "ARCHIVED") &&
        (!q || [p.name, p.summary ?? "", p.repoUrl ?? "", ...p.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [projects, query, showArchived]);

  const visible = useMemo(() => {
    const cmp = SORTS.find((s) => s.value === sort)!.cmp;
    return base
      .filter((p) => !statuses.length || statuses.includes(p.status))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || cmp(a, b));
  }, [base, statuses, sort]);

  const counts = useMemo(() => {
    const c: Partial<Record<ProjectStatus, number>> = {};
    for (const p of base) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [base]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status !== "ARCHIVED");
    const avg = active.length ? Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length) : 0;
    return {
      total: active.length,
      avg,
      ideas: active.filter((p) => p.status === "IDEA").length,
      building: active.filter((p) => p.status === "IN_PROGRESS").length,
      done: active.filter((p) => p.status === "DONE").length,
      repos: active.filter((p) => p.repoUrl).length,
    };
  }, [projects]);

  const upsert = useCallback((p: ProjectListItem) => {
    setProjects((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? { ...x, ...p } : x)) : [p, ...list]));
  }, []);

  async function patch(p: ProjectListItem, data: Partial<ProjectListItem>) {
    const before = projects;
    setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, ...data } : x)));
    setError(null);
    try {
      const res = await api<{ project: ProjectListItem }>(`/api/projects/${p.id}`, { method: "PATCH", body: data });
      upsert(res.project);
    } catch (e) {
      setProjects(before);
      setError(errorMessage(e));
    }
  }

  const cardProps = {
    onStatus: (p: ProjectListItem, status: ProjectStatus) => void patch(p, { status }),
    onFavorite: (p: ProjectListItem) => void patch(p, { favorite: !p.favorite }),
    onEdit: (p: ProjectListItem) => setDialog({ project: p }),
  };

  const toggleStatus = (s: ProjectStatus) => setStatuses((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));

  const grid = (list: ProjectListItem[]) => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {list.map((p, i) => (
        <ProjectCard key={p.id} project={p} index={i} {...cardProps} />
      ))}
    </div>
  );

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hallo, <span className="gradient-text">{greeting}</span>
          </h1>
          <p className="mt-1 text-muted">
            {stats.total === 0 ? "Zeit für die erste Idee." : `${stats.total} Projekt${stats.total === 1 ? "" : "e"} im Blick.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setDialog({ project: null })}>
          <Plus size={17} /> Neues Projekt
        </button>
      </header>

      {projects.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Layers} label="Projekte" value={stats.total} hint={`Ø ${stats.avg} %`} />
          <StatCard icon={Lightbulb} label="Ideen" value={stats.ideas} />
          <StatCard icon={Hammer} label="In Entwicklung" value={stats.building} />
          <StatCard icon={CircleCheck} label="Fertig" value={stats.done} />
          <StatCard icon={GitBranch} label="Mit Repository" value={stats.repos} />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="glass fade-in flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent-ink"><FolderPlus size={30} /></span>
          <h2 className="mt-4 text-xl font-semibold">Noch keine Projekte</h2>
          <p className="mt-1 max-w-md text-muted">Ein Projekt braucht nur einen Namen. Beschreibung, Repository und Tags lassen sich jederzeit nachtragen.</p>
          <button className="btn btn-primary mt-6" onClick={() => setDialog({ project: null })}>
            <Plus size={17} /> Erstes Projekt anlegen
          </button>
        </div>
      ) : (
        <>
          <div className="glass mb-4 flex flex-wrap items-center gap-2 p-2">
            <div className="relative min-w-48 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="field !border-transparent !bg-transparent pl-9"
                placeholder="Suchen nach Name, Beschreibung, Tag …"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Projekte durchsuchen"
              />
            </div>
            <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div role="radiogroup" aria-label="Ansicht" className="flex rounded-xl border bg-bg/40 p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  role="radio"
                  aria-checked={view === v.value}
                  onClick={() => setView(v.value)}
                  title={v.label}
                  aria-label={v.label}
                  className={cn("rounded-lg p-1.5 transition", view === v.value ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}
                >
                  <v.icon size={17} />
                </button>
              ))}
            </div>
            <button
              className={cn("btn btn-sm", showArchived && "chip-active")}
              aria-pressed={showArchived}
              onClick={() => setShowArchived((s) => !s)}
              title="Archivierte Projekte zeigen"
            >
              <Archive size={15} /> <span className="hidden sm:inline">Archiv</span>
            </button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button className={cn("chip", !statuses.length && "chip-active")} onClick={() => setStatuses([])}>
              Alle <span className="tabular-nums opacity-70">{base.length}</span>
            </button>
            {PROJECT_STATUSES.filter((s) => showArchived || s.value !== "ARCHIVED").map((s) => (
              <button key={s.value} className={cn("chip", statuses.includes(s.value) && "chip-active")} onClick={() => toggleStatus(s.value)} aria-pressed={statuses.includes(s.value)}>
                <span className="h-2 w-2 rounded-full" style={{ background: `var(${s.cssVar})` }} />
                {s.label} <span className="tabular-nums opacity-70">{counts[s.value] ?? 0}</span>
              </button>
            ))}
          </div>

          {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          {visible.length === 0 ? (
            <div className="glass px-6 py-12 text-center">
              <p className="font-medium">Keine Treffer</p>
              <p className="mt-1 text-sm text-muted">Suche oder Filter lockern.</p>
              <button className="btn btn-sm mt-4" onClick={() => { setQuery(""); setStatuses([]); }}>Filter zurücksetzen</button>
            </div>
          ) : view === "grid" ? (
            grid(visible)
          ) : view === "list" ? (
            <div className="space-y-2">
              {visible.map((p) => (
                <ProjectRow key={p.id} project={p} {...cardProps} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {PROJECT_STATUSES.map((s) => {
                const list = visible.filter((p) => p.status === s.value);
                if (!list.length) return null;
                return (
                  <section key={s.value}>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${s.cssVar})` }} />
                      {s.label} <span className="font-normal">{list.length}</span>
                    </h2>
                    {grid(list)}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <ProjectDialog
        open={dialog !== null}
        project={dialog?.project}
        onClose={() => setDialog(null)}
        onSaved={upsert}
        onDeleted={(id) => setProjects((list) => list.filter((p) => p.id !== id))}
      />
    </div>
  );
}
