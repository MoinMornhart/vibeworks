import Link from "next/link";
import { GitBranch, Globe, MessageCircle, Users } from "lucide-react";
import { requirePageUser, displayNameOf } from "@/lib/auth/guard";
import { communityOn, feedbackInbox, listCommunityProjects, myCommunityProjects, viewerOf } from "@/lib/community";
import { FeedbackInbox } from "@/components/community/FeedbackInbox";
import { OfficialBadge } from "@/components/community/OfficialToggle";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { getT } from "@/lib/i18n/server";
import { AccentStrip } from "@/components/projects/ProjectCard";
import { CommunityMine } from "@/components/community/CommunityMine";
import { ChatPanel } from "@/components/community/ChatPanel";
import { LOBBY } from "@/lib/communityLogic";

export async function generateMetadata() {
  return { title: (await getT("community"))("title") };
}

export default async function CommunityPage() {
  const user = await requirePageUser();
  const [t, ts] = await Promise.all([getT("community"), getT("status")]);
  if (!(await communityOn())) {
    return (
      <section className="glass mx-auto max-w-2xl p-8 text-center">
        <Users className="mx-auto text-muted" size={28} />
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("off")}</p>
      </section>
    );
  }
  const [projects, mine, viewer, feedback] = await Promise.all([listCommunityProjects(), myCommunityProjects(user.id), viewerOf(user), feedbackInbox(user.id)]);

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Users size={28} className="text-accent-ink" /> {t("title")}
        </h1>
        <p className="mt-1 max-w-3xl text-muted">{t("intro")}</p>
        {viewer.banned && <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">{t("bannedNotice")}</p>}
      </header>

      {projects.length === 0 ? (
        <p className="glass px-6 py-14 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="community-projects">
          {projects.map((p) => {
            const status = PROJECT_STATUS_MAP[p.status];
            const accent = PROJECT_ACCENTS[p.accent] ?? PROJECT_ACCENTS.violet;
            return (
              <li key={p.id} className="glass relative flex flex-col p-5">
                <AccentStrip accent={p.accent} />
                <Link href={`/community/${p.id}`} className="break-words text-lg font-semibold hover:text-accent-ink">
                  {p.name}
                </Link>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {t("by", { name: displayNameOf(p.owner) })}
                  {p.communityOfficial && <OfficialBadge />}
                </p>
                {p.summary && <p className="mt-1 text-sm text-muted">{p.summary}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="chip !py-0.5" style={{ color: `var(${status.cssVar})` }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${p.status}`)}
                  </span>
                  <span className="ml-auto tabular-nums text-muted">{p.progress} %</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
                  <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-4 text-sm">
                  <Link href={`/community/${p.id}`} className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
                    <MessageCircle size={14} /> {t("openPosts", { n: p._count.communityPosts })}
                  </Link>
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
                      <Globe size={14} /> {t("live")}
                    </a>
                  )}
                  {p.repoUrl && !p.repoUrl.startsWith("git@") && (
                    <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
                      <GitBranch size={14} /> {t("code")}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mine.some((m) => m.inCommunity) && <FeedbackInbox items={feedback} />}

      <ChatPanel room={LOBBY} title={t("chat.lobby")} hint={t("chat.lobbyHint")} />

      <CommunityMine initial={mine} />
    </div>
  );
}
