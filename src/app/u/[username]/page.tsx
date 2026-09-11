import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ExternalLink, Eye, GitBranch, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { displayNameOf } from "@/lib/auth/guard";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { getT } from "@/lib/i18n/server";
import { Markdown } from "@/components/Markdown";
import { AccentStrip } from "@/components/projects/ProjectCard";

// Öffentliches Portfolio – ohne Anmeldung (siehe Middleware). Gezeigt wird
// nur, was der Besitzer ausgewählt hat: Name, Kurzbeschreibung, Stand, Links.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

const load = cache(async (username: string) => {
  const name = decodeURIComponent(username).toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(name)) return null;
  const user = await db.user.findUnique({
    where: { username: name },
    select: { id: true, username: true, displayName: true, portfolioPublic: true, portfolioBio: true, active: true },
  });
  if (!user?.active || !user.portfolioPublic) return null;
  const projects = await db.project.findMany({
    where: { ownerId: user.id, inPortfolio: true, buriedAt: null },
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, summary: true, status: true, progress: true, accent: true, tags: true, repoUrl: true, liveUrl: true, shareToken: true },
  });
  return { user, projects };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [data, t] = await Promise.all([params.then((p) => load(p.username)), getT("portfolio")]);
  if (!data) return { title: "404", robots: { index: false } };
  return { title: t("page.metaTitle", { name: displayNameOf(data.user) }), description: data.user.portfolioBio?.slice(0, 160) ?? undefined };
}

export default async function PortfolioPage({ params }: Props) {
  const data = await load((await params).username);
  if (!data) notFound();
  const { user, projects } = data;
  const [t, ts] = await Promise.all([getT("portfolio"), getT("status")]);
  const name = displayNameOf(user);
  const done = projects.filter((p) => p.status === "DONE").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-6 sm:px-5 sm:py-8">
      <header className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches SVG-Logo */}
          <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
          {config.appName}
        </Link>
        <span className="chip !py-0.5 text-xs"><Eye size={13} /> {t("page.badge")}</span>
      </header>

      <section className="glass p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-on-accent">{name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
            <p className="text-muted">@{user.username}</p>
          </div>
        </div>
        {user.portfolioBio && (
          <div className="mt-5 max-w-2xl" data-testid="portfolio-bio">
            <Markdown>{user.portfolioBio}</Markdown>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">{t("page.stats", { n: projects.length, done })}</p>
      </section>

      {projects.length === 0 ? (
        <p className="glass px-6 py-14 text-center text-muted">{t("page.empty")}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const status = PROJECT_STATUS_MAP[p.status];
            const accent = PROJECT_ACCENTS[p.accent] ?? PROJECT_ACCENTS.violet;
            return (
              <li key={p.id} className="glass relative flex flex-col p-5" data-testid="portfolio-project">
                <AccentStrip accent={p.accent} />
                <h2 className="break-words text-lg font-semibold">{p.name}</h2>
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
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="chip">#{tag}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-4 pt-4 text-sm">
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline"><Globe size={14} /> {t("page.live")}</a>
                  )}
                  {p.repoUrl && !p.repoUrl.startsWith("git@") && (
                    <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink hover:underline"><GitBranch size={14} /> {t("page.code")}</a>
                  )}
                  {p.shareToken && (
                    <Link href={`/s/${p.shareToken}`} className="inline-flex items-center gap-1.5 text-accent-ink hover:underline"><ExternalLink size={14} /> {t("page.details")}</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="pb-4 text-center text-xs text-muted">{t("page.footer", { app: config.appName })}</footer>
    </div>
  );
}
