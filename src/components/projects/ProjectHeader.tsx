"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import { ArrowLeft, CalendarPlus, ExternalLink, GitBranch, History, Pencil, Star } from "lucide-react";
import type { ProjectDetail, ProjectListItem } from "@/lib/projects";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate, timeAgo } from "@/lib/utils";
import { accentGradient, PriorityBadge, ProgressBar } from "./ProjectCard";
import { StatusSelect } from "./StatusSelect";
import { ProjectDialog } from "./ProjectDialog";
import { Markdown } from "@/components/Markdown";

export function ProjectHeader({ initial }: { initial: ProjectDetail }) {
  const router = useRouter();
  const [p, setP] = useState<ProjectDetail>(initial);
  // Nach router.refresh() (z. B. neuer Fortschritt aus Aufgaben) neue Daten übernehmen.
  useEffect(() => setP(initial), [initial]);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Partial<ProjectListItem>) {
    const before = p;
    setP({ ...p, ...data });
    setError(null);
    try {
      const res = await api<{ project: ProjectDetail }>(`/api/projects/${p.id}`, { method: "PATCH", body: data });
      setP(res.project);
    } catch (e) {
      setP(before);
      setError(errorMessage(e));
    }
  }

  return (
    <div className="fade-in space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <section className="glass relative overflow-visible p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-[1.25rem]" style={{ background: accentGradient(p.accent) }} />
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{p.name}</h1>
            {p.summary && <p className="mt-2 text-lg text-muted">{p.summary}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => void patch({ favorite: !p.favorite })} aria-pressed={p.favorite} aria-label={p.favorite ? "Favorit entfernen" : "Als Favorit markieren"} className="btn btn-ghost btn-icon">
              <Star size={18} className={p.favorite ? "fill-amber-400 text-amber-400" : "text-muted"} />
            </button>
            <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Bearbeiten
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <StatusSelect value={p.status} onChange={(status: ProjectStatus) => void patch({ status })} align="left" />
          <PriorityBadge priority={p.priority} />
          <span className="inline-flex items-center gap-1.5 text-muted"><CalendarPlus size={14} /> angelegt {formatDate(p.createdAt)}</span>
          <span className="inline-flex items-center gap-1.5 text-muted" suppressHydrationWarning><History size={14} /> geändert {timeAgo(p.updatedAt)}</span>
          {p.repoUrl && (
            <a href={p.repoUrl.startsWith("git@") ? undefined : p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
              <GitBranch size={14} /> {p.repoUrl.replace(/^https?:\/\//, "")} {!p.repoUrl.startsWith("git@") && <ExternalLink size={12} />}
            </a>
          )}
        </div>

        <div className="mt-6 max-w-xl">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">Fortschritt</span>
            <span className="font-semibold tabular-nums">{p.progress} %</span>
          </div>
          <ProgressBar value={p.progress} accent={p.accent} className="!h-2.5" />
        </div>

        {p.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span key={t} className="chip">#{t}</span>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </section>

      <section className="glass p-6 sm:p-8">
        <h2 className="mb-3 text-lg font-semibold">Beschreibung</h2>
        {p.description ? (
          <Markdown>{p.description}</Markdown>
        ) : (
          <p className="text-muted">
            Noch keine Beschreibung.{" "}
            <button className="text-accent-ink hover:underline" onClick={() => setEditOpen(true)}>Jetzt ergänzen</button>
          </p>
        )}
      </section>

      <ProjectDialog
        open={editOpen}
        project={p}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setP((cur) => ({ ...cur, ...saved, description: saved.description ?? cur.description }));
          router.refresh();
        }}
        onDeleted={() => {
          router.push("/");
          router.refresh();
        }}
      />
    </div>
  );
}
