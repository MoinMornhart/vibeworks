"use client";

import Link from "next/link";
import { Bell, Users } from "lucide-react";
import type { ProjectStatus, ProjectRole } from "@prisma/client";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { useT } from "@/lib/i18n/client";

export interface SharedProjectCard {
  id: string;
  name: string;
  summary: string | null;
  status: ProjectStatus;
  progress: number;
  accent: string;
  owner: string;
  role: ProjectRole;
}

export interface PendingRequestItem {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  role: ProjectRole;
}

/** Hinweis auf offene Zugriffsanfragen an eigenen Projekten. */
export function PendingRequests({ items }: { items: PendingRequestItem[] }) {
  const t = useT("share");
  if (!items.length) return null;
  return (
    <div className="glass mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-accent/40 px-4 py-3 text-sm" role="status">
      <Bell size={16} className="shrink-0 text-accent-ink" />
      <span className="font-medium">{t("shared.pending", { n: items.length })}</span>
      <ul className="flex flex-wrap gap-2">
        {items.slice(0, 5).map((r) => (
          <li key={r.id}>
            <Link href={`/projects/${r.projectId}?teilen=1`} className="chip hover:border-accent/60">
              {t("shared.pendingItem", { name: r.name, project: r.projectName, role: t(`roleLower.${r.role}`) })}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Projekte anderer Konten, in denen man Mitglied ist. */
export function SharedProjects({ projects }: { projects: SharedProjectCard[] }) {
  const t = useT("share");
  const ts = useT("status");
  if (!projects.length) return null;
  return (
    <section className="mt-10" aria-labelledby="shared-heading">
      <h2 id="shared-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
        <Users size={15} /> {t("shared.heading")} <span className="font-normal">{projects.length}</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {projects.map((p) => {
          const accent = PROJECT_ACCENTS[p.accent] ?? PROJECT_ACCENTS.violet;
          const status = PROJECT_STATUS_MAP[p.status];
          const gradient = `linear-gradient(90deg, ${accent.from}, ${accent.to})`;
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="glass group relative block overflow-hidden p-5 transition hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: gradient }} />
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-lg font-semibold">{p.name}</h3>
                <span className="chip shrink-0 !py-0.5 text-[11px]">{t(`role.${p.role}`)}</span>
              </div>
              {p.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p>}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: gradient }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{t("shared.by", { name: p.owner })}</span>
                <span className="inline-flex items-center gap-1.5" style={{ color: `var(${status.cssVar})` }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${p.status}`)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
