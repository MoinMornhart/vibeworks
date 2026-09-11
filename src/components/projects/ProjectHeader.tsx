"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import { ArrowLeft, CalendarPlus, Download, ExternalLink, Ghost, GitBranch, HeartPulse, History, LayoutTemplate, LogOut, Pencil, Share2, Star, Users } from "lucide-react";
import { BuryDialog } from "@/components/grave/BuryDialog";
import type { ProjectDetail, ProjectListItem } from "@/lib/projects";
import type { ProjectAccess } from "@/lib/access";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { accentGradient, LiveIcon, PriorityBadge, ProgressBar } from "./ProjectCard";
import { StatusSelect } from "./StatusSelect";
import { ProjectDialog } from "./ProjectDialog";
import { Markdown } from "@/components/Markdown";
import { ShareDialog } from "@/components/share/ShareDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import type { ProgressAnalysis } from "@/lib/progress";
import { ProgressAnalysisView } from "./ProgressAnalysisView";

export function ProjectHeader({
  initial,
  access = "OWNER",
  ownerName,
  pendingRequests = 0,
  openShare = false,
  analysis = null,
}: {
  initial: ProjectDetail;
  access?: ProjectAccess;
  ownerName?: string;
  pendingRequests?: number;
  /** Automatischer Fortschritt: Bestandteile für „Wie berechnet?“ */
  analysis?: ProgressAnalysis | null;
  /** Teilen-Dialog gleich öffnen (Link aus dem Hinweis auf dem Dashboard) */
  openShare?: boolean;
}) {
  const t = useT("projects");
  const ts = useT("status");
  const tc = useT("common");
  const td = useT("data");
  const f = useFormat();
  const router = useRouter();
  const isOwner = access === "OWNER";
  const canEdit = access !== "VIEWER";
  const [p, setP] = useState<ProjectDetail>(initial);
  // Nach router.refresh() (z. B. neuer Fortschritt aus Aufgaben) neue Daten übernehmen.
  useEffect(() => setP(initial), [initial]);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(openShare && isOwner);
  const [pending, setPending] = useState(pendingRequests);
  useEffect(() => setPending(pendingRequests), [pendingRequests]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tg = useT("grave");
  const [buryOpen, setBuryOpen] = useState(false);

  async function resurrect() {
    setError(null);
    try {
      await api(`/api/projects/${p.id}/grave`, { body: { action: "resurrect" } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function saveTemplate() {
    const name = window.prompt(td("templates.namePrompt"), p.name)?.trim();
    if (!name) return;
    setError(null);
    setNotice(null);
    try {
      await api("/api/templates", { body: { projectId: p.id, name } });
      setNotice(td("templates.saved", { name }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function patch(data: Partial<ProjectListItem>) {
    const before = p;
    setP({ ...p, ...data });
    setError(null);
    try {
      const res = await api<{ project: ProjectDetail }>(`/api/projects/${p.id}`, { method: "PATCH", body: data });
      setP(res.project);
      // Neuer Status → neue Analyse (Obergrenze)
      if (res.project.progressFromTasks && data.status) router.refresh();
    } catch (e) {
      setP(before);
      setError(errorMessage(e));
    }
  }

  async function leave() {
    if (!window.confirm(t("header.confirmLeave", { name: p.name }))) return;
    try {
      await api(`/api/projects/${p.id}/members/me`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const status = PROJECT_STATUS_MAP[p.status];

  return (
    <div className="fade-in space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> {t("header.dashboard")}
      </Link>

      {p.buriedAt && (
        <div className="glass flex flex-wrap items-center gap-3 px-5 py-3 text-sm" role="status">
          <span aria-hidden>🪦</span>
          <span suppressHydrationWarning>{tg("header.buried", { date: f.date(p.buriedAt) })}</span>
          {isOwner && (
            <button className="btn btn-primary btn-sm ml-auto" onClick={() => void resurrect()}>
              <HeartPulse size={14} /> {tg("stone.resurrect")}
            </button>
          )}
        </div>
      )}

      <section className="glass relative overflow-visible p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-[1.25rem]" style={{ background: accentGradient(p.accent) }} />
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{p.name}</h1>
            {p.summary && <p className="mt-2 text-lg text-muted">{p.summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {isOwner && (
              <button onClick={() => void patch({ favorite: !p.favorite })} aria-pressed={p.favorite} aria-label={p.favorite ? t("card.favoriteRemove") : t("card.favoriteAdd")} className="btn btn-ghost btn-icon">
                <Star size={18} className={p.favorite ? "fill-amber-400 text-amber-400" : "text-muted"} />
              </button>
            )}
            {isOwner && (
              <button className="btn btn-sm" onClick={() => setShareOpen(true)}>
                <Share2 size={14} /> {t("header.share")}
                {pending > 0 && (
                  <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent" aria-label={t("header.pendingRequests", { n: pending })}>{pending}</span>
                )}
              </button>
            )}
            {canEdit && (
              <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
                <Pencil size={14} /> {tc("edit")}
              </button>
            )}
            <ActionMenu
              label={td("more")}
              items={[
                { label: td("templates.saveAs"), icon: LayoutTemplate, onClick: () => void saveTemplate() },
                { label: td("export.project"), icon: Download, onClick: () => window.location.assign(`/api/projects/${p.id}/export`) },
                ...(isOwner && !p.buriedAt ? [{ label: tg("bury.menu"), icon: Ghost, onClick: () => setBuryOpen(true) }] : []),
              ]}
            />
            {!isOwner && (
              <button className="btn btn-sm" onClick={() => void leave()} title={t("header.leaveTitle")}>
                <LogOut size={14} /> {t("header.leave")}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          {canEdit ? (
            <StatusSelect value={p.status} onChange={(s: ProjectStatus) => void patch({ status: s })} align="left" />
          ) : (
            <span className="chip !py-0.5" style={{ color: `var(${status.cssVar})` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${p.status}`)}
            </span>
          )}
          <PriorityBadge priority={p.priority} />
          {!isOwner && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Users size={14} /> {t("header.sharedBy", { name: ownerName ?? "–" })} · {t(`header.role.${access}`)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-muted"><CalendarPlus size={14} /> {t("header.created", { date: f.date(p.createdAt) })}</span>
          <span className="inline-flex items-center gap-1.5 text-muted" suppressHydrationWarning><History size={14} /> {t("header.updated", { ago: f.ago(p.updatedAt) })}</span>
          {p.repoUrl && (
            <a href={p.repoUrl.startsWith("git@") ? undefined : p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
              <GitBranch size={14} /> {p.repoUrl.replace(/^https?:\/\//, "")} {!p.repoUrl.startsWith("git@") && <ExternalLink size={12} />}
            </a>
          )}
          {p.liveUrl && (
            <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 hover:underline ${p.liveState === "down" ? "text-red-400" : "text-accent-ink"}`}>
              <LiveIcon state={p.liveState} /> {p.liveUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div className="mt-6 max-w-xl">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">{t("header.progress")}</span>
            <span className="font-semibold tabular-nums">{p.progress} %</span>
          </div>
          <ProgressBar value={p.progress} accent={p.accent} className="!h-2.5" />
          {p.progressFromTasks && analysis && <ProgressAnalysisView analysis={analysis} />}
        </div>

        {p.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span key={t} className="chip">#{t}</span>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-emerald-400">{notice}</p>}
      </section>

      <section className="glass p-6 sm:p-8">
        <h2 className="mb-3 text-lg font-semibold">{t("header.description")}</h2>
        {p.description ? (
          <Markdown>{p.description}</Markdown>
        ) : (
          <p className="text-muted">
            {t("header.noDescription")}
            {canEdit && (
              <>
                {" "}
                <button className="text-accent-ink hover:underline" onClick={() => setEditOpen(true)}>{t("header.addNow")}</button>
              </>
            )}
          </p>
        )}
      </section>

      {canEdit && (
        <ProjectDialog
          open={editOpen}
          project={p}
          ownerControls={isOwner}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => {
            setP((cur) => ({ ...cur, ...saved, description: saved.description ?? cur.description }));
            router.refresh();
          }}
          onDeleted={
            isOwner
              ? () => {
                  router.push("/");
                  router.refresh();
                }
              : undefined
          }
        />
      )}
      {isOwner && <ShareDialog projectId={p.id} open={shareOpen} onClose={() => setShareOpen(false)} onPendingChange={setPending} />}
      {isOwner && (
        <BuryDialog
          project={buryOpen ? { id: p.id, name: p.name } : null}
          onClose={() => setBuryOpen(false)}
          onBuried={() => {
            router.push("/graveyard");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
