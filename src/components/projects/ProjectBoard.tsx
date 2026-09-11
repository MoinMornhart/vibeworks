"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import {
  Archive,
  CircleCheck,
  Columns3,
  FolderPlus,
  GitBranch,
  Hammer,
  Layers,
  LayoutGrid,
  Lightbulb,
  List,
  Plus,
  Rows3,
  Search,
} from "lucide-react";
import type { ProjectListItem } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { useAutoRefresh } from "@/lib/client/useAutoRefresh";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ProjectCard, ProjectRow } from "./ProjectCard";
import { ProjectDialog } from "./ProjectDialog";
import { KanbanBoard } from "./KanbanBoard";
import { BulkBar, type BulkAction } from "./BulkBar";
import Link from "next/link";
import { Highlight } from "@/components/Highlight";
import type { SearchResult } from "@/lib/search";

type View = "grid" | "list" | "grouped" | "kanban";
type Sort = "updated" | "created" | "name" | "progress" | "priority" | "status";

// Beschriftungen kommen aus dem Namensraum „projects“ (sort.*).
const SORTS: Array<{ value: Sort; cmp: (a: ProjectListItem, b: ProjectListItem) => number }> = [
  { value: "updated", cmp: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  { value: "created", cmp: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { value: "name", cmp: (a, b) => a.name.localeCompare(b.name, "de") },
  { value: "progress", cmp: (a, b) => b.progress - a.progress },
  { value: "priority", cmp: (a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt) },
  // Reihenfolge der Status von der Idee bis Fertig (Archiviert zuletzt),
  // innerhalb eines Status die zuletzt geänderten zuerst.
  { value: "status", cmp: (a, b) => statusRank(a.status) - statusRank(b.status) || b.updatedAt.localeCompare(a.updatedAt) },
];

function statusRank(status: ProjectStatus): number {
  return PROJECT_STATUSES.findIndex((s) => s.value === status);
}

// Beschriftungen kommen aus dem Namensraum „projects“ (view.*).
const VIEWS: Array<{ value: View; icon: typeof LayoutGrid }> = [
  { value: "grid", icon: LayoutGrid },
  { value: "list", icon: List },
  { value: "grouped", icon: Rows3 },
  { value: "kanban", icon: Columns3 },
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
  const t = useT("projects");
  const ts = useT("status");
  const [projects, setProjects] = useState(initial);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<View>("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ project: ProjectListItem | null } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<SearchResult | null>(null);

  // Neue Serverdaten (z. B. nach der Schnellerfassung) übernehmen.
  useEffect(() => setProjects(initial), [initial]);
  // Statuswechsel auf der Projektseite, in anderen Tabs oder Geräten übernehmen
  useAutoRefresh();

  // Notizen und Aufgaben liegen im Board nicht vor – die sucht der Server
  // im Volltext, entprellt ab zwei Zeichen.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(setHits)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  const hitProjects = useMemo(() => new Set([...(hits?.notes ?? []), ...(hits?.tasks ?? [])].map((h) => h.projectId)), [hits]);

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
        (!q || hitProjects.has(p.id) || [p.name, p.summary ?? "", p.repoUrl ?? "", ...p.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [projects, query, showArchived, hitProjects]);

  const visible = useMemo(() => {
    const cmp = SORTS.find((s) => s.value === sort)!.cmp;
    const fav = (a: ProjectListItem, b: ProjectListItem) => Number(b.favorite) - Number(a.favorite);
    return base
      .filter((p) => !statuses.length || statuses.includes(p.status))
      // Favoriten ziehen nur bei „Priorität“ nach oben – sie gelten dort als
      // wichtigste Stufe. Alle anderen Sortierungen folgen allein ihrem Kriterium.
      .sort((a, b) => (sort === "priority" ? fav(a, b) || cmp(a, b) : cmp(a, b)));
  }, [base, statuses, sort]);

  const kanbanColumns = useMemo(
    () => PROJECT_STATUSES.map((s) => s.value).filter((s) => (showArchived || s !== "ARCHIVED") && (!statuses.length || statuses.includes(s))),
    [showArchived, statuses],
  );

  // Was der Filter ausblendet, fällt aus der Auswahl – eine Massenänderung
  // soll nur treffen, was man gerade vor Augen hat.
  const selectedVisible = useMemo(
    () => (view === "kanban" ? [] : visible.filter((p) => selected.has(p.id)).map((p) => p.id)),
    [visible, selected, view],
  );

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

  async function refresh() {
    const res = await api<{ projects: ProjectListItem[] }>("/api/projects?archived=1");
    setProjects(res.projects);
  }

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

  function reorder(status: ProjectStatus, visibleIds: string[]) {
    // Durch die Suche ausgeblendete Karten derselben Spalte hinten anhängen,
    // damit der Server die vollständige Spalte bekommt.
    const hidden = projects
      .filter((p) => p.status === status && !visibleIds.includes(p.id))
      .sort((a, b) => a.position - b.position)
      .map((p) => p.id);
    const ids = [...visibleIds, ...hidden];
    const before = projects;
    setProjects((list) =>
      list.map((p) => {
        const i = ids.indexOf(p.id);
        return i >= 0 ? { ...p, status, position: i } : p;
      }),
    );
    setError(null);
    api("/api/projects/reorder", { method: "PATCH", body: { status, ids } }).catch((e) => {
      setProjects(before);
      setError(errorMessage(e));
    });
  }

  async function bulk(action: BulkAction) {
    setError(null);
    try {
      await api("/api/projects/bulk", { body: { ...action, ids: selectedVisible } });
      if (action.action === "delete") setSelected(new Set());
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const toggleSelect = (p: ProjectListItem) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });

  const handlers = {
    onStatus: (p: ProjectListItem, status: ProjectStatus) => void patch(p, { status }),
    onFavorite: (p: ProjectListItem) => void patch(p, { favorite: !p.favorite }),
    onEdit: (p: ProjectListItem) => setDialog({ project: p }),
  };
  const selection = (p: ProjectListItem) => ({ selected: selected.has(p.id), selecting: selectedVisible.length > 0, onSelect: toggleSelect });

  const toggleStatus = (s: ProjectStatus) => setStatuses((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));

  const grid = (list: ProjectListItem[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {list.map((p, i) => (
        <ProjectCard key={p.id} project={p} index={i} {...handlers} {...selection(p)} />
      ))}
    </div>
  );

  return (
    <div className={cn(selectedVisible.length > 0 && "pb-24")}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("board.hello")} <span className="gradient-text">{greeting}</span>
          </h1>
          <p className="mt-1 text-muted">
            {stats.total === 0 ? t("board.firstIdea") : t("board.inView", { n: stats.total })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setDialog({ project: null })}>
          <Plus size={17} /> {t("board.newProject")}
        </button>
      </header>

      {projects.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Layers} label={t("board.stats.projects")} value={stats.total} hint={t("board.stats.avg", { n: stats.avg })} />
          <StatCard icon={Lightbulb} label={t("board.stats.ideas")} value={stats.ideas} />
          <StatCard icon={Hammer} label={t("board.stats.building")} value={stats.building} />
          <StatCard icon={CircleCheck} label={t("board.stats.done")} value={stats.done} />
          <StatCard icon={GitBranch} label={t("board.stats.repos")} value={stats.repos} />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="glass fade-in flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent-ink"><FolderPlus size={30} /></span>
          <h2 className="mt-4 text-xl font-semibold">{t("board.empty.title")}</h2>
          <p className="mt-1 max-w-md text-muted">{t("board.empty.text")}</p>
          <button className="btn btn-primary mt-6" onClick={() => setDialog({ project: null })}>
            <Plus size={17} /> {t("board.empty.create")}
          </button>
        </div>
      ) : (
        <>
          <div className="glass mb-4 flex flex-wrap items-center gap-2 p-2">
            <div className="relative min-w-48 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="field !border-transparent !bg-transparent pl-9"
                placeholder={t("board.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t("board.searchLabel")}
              />
            </div>
            <select
              className="field !w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label={t("board.sortLabel")}
              disabled={view === "kanban"}
              title={view === "kanban" ? t("board.sortKanbanHint") : undefined}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{t(`sort.${s.value}`)}</option>
              ))}
            </select>
            <div role="radiogroup" aria-label={t("board.viewLabel")} className="flex rounded-xl border bg-bg/40 p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  role="radio"
                  aria-checked={view === v.value}
                  onClick={() => setView(v.value)}
                  title={t(`view.${v.value}`)}
                  aria-label={t(`view.${v.value}`)}
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
              title={t("board.archivedTitle")}
            >
              <Archive size={15} /> <span className="hidden sm:inline">{t("board.archive")}</span>
            </button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button className={cn("chip", !statuses.length && "chip-active")} onClick={() => setStatuses([])}>
              {t("board.all")} <span className="tabular-nums opacity-70">{base.length}</span>
            </button>
            {PROJECT_STATUSES.filter((s) => showArchived || s.value !== "ARCHIVED").map((s) => (
              <button key={s.value} className={cn("chip", statuses.includes(s.value) && "chip-active")} onClick={() => toggleStatus(s.value)} aria-pressed={statuses.includes(s.value)}>
                <span className="h-2 w-2 rounded-full" style={{ background: `var(${s.cssVar})` }} />
                {ts(`project.${s.value}`)} <span className="tabular-nums opacity-70">{counts[s.value] ?? 0}</span>
              </button>
            ))}
          </div>

          {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          {hits && (hits.notes.length > 0 || hits.tasks.length > 0) && (
            <div className="glass mb-5 grid gap-4 p-4 md:grid-cols-2">
              {([
                [t("board.hitsNotes"), hits.notes.map((n) => ({ id: n.id, title: n.title, snippet: n.snippet, projectId: n.projectId, projectName: n.projectName }))],
                [t("board.hitsTasks"), hits.tasks.map((t) => ({ id: t.id, title: t.title, snippet: t.snippet, projectId: t.projectId, projectName: t.projectName }))],
              ] as const).map(([label, list]) =>
                list.length === 0 ? null : (
                  <section key={label} aria-label={label}>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label} <span className="font-normal">{list.length}</span></h2>
                    <ul className="space-y-1.5">
                      {list.map((h) => (
                        <li key={h.id}>
                          <Link href={`/projects/${h.projectId}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                            <span className="font-medium">{h.title ?? h.projectName}</span>
                            <span className="text-muted"> · {h.projectName}</span>
                            <span className="line-clamp-2 block text-xs text-muted"><Highlight text={h.snippet} /></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}

          {view === "kanban" ? (
            <KanbanBoard projects={base} statuses={kanbanColumns} onReorder={reorder} onFavorite={handlers.onFavorite} onEdit={handlers.onEdit} />
          ) : visible.length === 0 ? (
            <div className="glass px-6 py-12 text-center">
              <p className="font-medium">{t("board.noHits")}</p>
              <p className="mt-1 text-sm text-muted">{t("board.noHitsHint")}</p>
              <button className="btn btn-sm mt-4" onClick={() => { setQuery(""); setStatuses([]); }}>{t("board.resetFilters")}</button>
            </div>
          ) : view === "grid" ? (
            grid(visible)
          ) : view === "list" ? (
            <div className="space-y-2">
              {visible.map((p) => (
                <ProjectRow key={p.id} project={p} {...handlers} {...selection(p)} />
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
                      {ts(`project.${s.value}`)} <span className="font-normal">{list.length}</span>
                    </h2>
                    {grid(list)}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <BulkBar
        count={selectedVisible.length}
        total={visible.length}
        onAction={bulk}
        onSelectAll={() => setSelected(new Set(visible.map((p) => p.id)))}
        onClear={() => setSelected(new Set())}
      />

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
