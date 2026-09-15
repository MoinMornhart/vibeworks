import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch, Globe } from "lucide-react";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { bannedHere, communityOn, communityProject, loadPosts, viewerOf } from "@/lib/community";
import { canModerate, canWrite } from "@/lib/communityLogic";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { getT } from "@/lib/i18n/server";
import { AccentStrip } from "@/components/projects/ProjectCard";
import { CommunityBoard } from "@/components/community/CommunityBoard";
import { ChatPanel } from "@/components/community/ChatPanel";

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props) {
  const project = (await communityOn()) ? await communityProject((await params).projectId) : null;
  return { title: project ? project.name : (await getT("community"))("title") };
}

export default async function CommunityProjectPage({ params }: Props) {
  const user = await requirePageUser();
  if (!(await communityOn())) notFound();
  const project = await communityProject((await params).projectId);
  if (!project) notFound();
  const [t, ts, viewer] = await Promise.all([getT("community"), getT("status"), viewerOf(user)]);
  const [posts, banned] = await Promise.all([loadPosts(project.id, viewer, project.ownerId), bannedHere(project.id, user.id)]);
  const status = PROJECT_STATUS_MAP[project.status];
  const accent = PROJECT_ACCENTS[project.accent] ?? PROJECT_ACCENTS.violet;

  return (
    <div className="fade-in space-y-6">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> {t("back")}
      </Link>
      <section className="glass relative p-6 sm:p-8">
        <AccentStrip accent={project.accent} />
        <h1 className="break-words text-3xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted">{t("by", { name: displayNameOf(project.owner) })}</p>
        {project.summary && <p className="mt-3 max-w-3xl">{project.summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="chip !py-0.5" style={{ color: `var(${status.cssVar})` }}>
            <span className="h-2 w-2 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${project.status}`)}
          </span>
          <span className="tabular-nums text-muted">{project.progress} %</span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-fg/10">
            <span className="block h-full rounded-full" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
          </span>
          {project.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="chip">#{tag}</span>
          ))}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
              <Globe size={14} /> {t("live")}
            </a>
          )}
          {project.repoUrl && !project.repoUrl.startsWith("git@") && (
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
              <GitBranch size={14} /> {t("code")}
            </a>
          )}
        </div>
      </section>
      <CommunityBoard projectId={project.id} initialPosts={posts} canWrite={canWrite(viewer, banned)} moderator={canModerate(viewer, project.ownerId)} />
      <ChatPanel room={project.id} title={t("chat.project")} hint={t("chat.projectHint")} />
    </div>
  );
}
