import Link from "next/link";
import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject, taskDoneCounts } from "@/lib/projects";
import { AWAKE_STATUSES, lastSign, SLEEP_DAYS } from "@/lib/grave";
import { TriangleAlert } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { translateMessage } from "@/lib/i18n/messages";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { PendingRequests, SharedProjects } from "@/components/share/SharedProjects";
import { SleepingProjects } from "@/components/grave/SleepingProjects";
import { WeeklySuggestions } from "@/components/WeeklySuggestions";
import { ensureWeeklySuggestions, loadWeekSuggestions } from "@/lib/suggestions";

export default async function Dashboard() {
  const user = await requirePageUser();
  const now = new Date();
  const cutoff = new Date(now.getTime() - SLEEP_DAYS * 86_400_000);
  const [projects, done, shared, requests, drowsy, buried, tg] = await Promise.all([
    db.project.findMany({
      where: { ownerId: user.id, buriedAt: null },
      select: projectListSelect,
      orderBy: { updatedAt: "desc" },
    }),
    taskDoneCounts(user.id),
    // Projekte anderer Konten, in denen man Mitglied ist
    db.project.findMany({
      where: { members: { some: { userId: user.id } }, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        name: true,
        summary: true,
        status: true,
        progress: true,
        accent: true,
        owner: { select: { username: true, displayName: true } },
        members: { where: { userId: user.id }, select: { role: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Offene Zugriffsanfragen an eigene Projekte
    db.accessRequest.findMany({
      where: { status: "PENDING", project: { ownerId: user.id } },
      select: { id: true, role: true, user: { select: { username: true, displayName: true } }, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Schläft seit 30 Tagen? Kandidaten nach „zuletzt geändert“, Commits prüfen wir danach
    db.project.findMany({
      where: {
        ownerId: user.id,
        buriedAt: null,
        favorite: false, // mit Stern geschützt – der Friedhof fragt nicht
        status: { in: AWAKE_STATUSES },
        updatedAt: { lt: cutoff },
        OR: [{ nudgeSnoozedUntil: null }, { nudgeSnoozedUntil: { lt: now } }],
      },
      select: { id: true, name: true, accent: true, updatedAt: true, repoCache: { select: { commits: true } } },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    db.project.count({ where: { ownerId: user.id, buriedAt: { not: null } } }),
    getT("grave"),
  ]);
  const [inboxCount, ti, gitFailing, gitFailingCount, brokenConnections, tgit, locale] = await Promise.all([
    db.inboxItem.count({ where: { userId: user.id } }),
    getT("inbox"),
    // Git-Probleme: Projekte, deren letzter Abgleich scheiterte, und Verbindungen mit Import-Fehler
    db.project.findMany({
      where: { ownerId: user.id, buriedAt: null, status: { not: "ARCHIVED" }, repoCache: { error: { not: null } } },
      select: { id: true, name: true, repoCache: { select: { error: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.project.count({ where: { ownerId: user.id, buriedAt: null, status: { not: "ARCHIVED" }, repoCache: { error: { not: null } } } }),
    db.gitCredential.findMany({ where: { userId: user.id, importError: { not: null } }, select: { id: true, host: true, importError: true } }),
    getT("git"),
    getLocale(),
  ]);
  // Wochen-Vorschläge: beim ersten Besuch der Woche anlegen, dann nur lesen
  await ensureWeeklySuggestions(user.id, now, locale);
  const suggestions = await loadWeekSuggestions(user.id, now);
  const sleeping = drowsy
    .map((p) => ({ id: p.id, name: p.name, accent: p.accent, since: lastSign(p.updatedAt, p.repoCache?.commits) }))
    .filter((p) => p.since < cutoff)
    .slice(0, 5)
    .map((p) => ({ ...p, since: p.since.toISOString() }));

  return (
    <>
      <PendingRequests
        items={requests.map((r) => ({ id: r.id, projectId: r.project.id, projectName: r.project.name, name: displayNameOf(r.user), role: r.role }))}
      />
      {inboxCount > 0 && (
        <Link href="/inbox" className="glass fade-in mb-6 flex items-center gap-3 px-5 py-3 text-sm hover:text-accent-ink" data-testid="inbox-banner">
          <span aria-hidden>📥</span> {ti("banner", { n: inboxCount })}
        </Link>
      )}
      {(gitFailingCount > 0 || brokenConnections.length > 0) && (
        <section className="glass fade-in mb-6 px-5 py-4 text-sm" role="alert" data-testid="git-problems">
          <p className="flex items-center gap-2 font-semibold text-red-400">
            <TriangleAlert size={16} /> {gitFailingCount > 0 ? tgit("problems.title", { n: gitFailingCount }) : tgit("problems.connectionsTitle")}
          </p>
          <ul className="mt-2 space-y-1">
            {brokenConnections.map((c) => (
              <li key={c.id}>
                <Link href="/account#git-zugang" className="hover:text-accent-ink">
                  <b>{tgit("problems.connection", { host: c.host })}</b> <span className="text-muted">– {translateMessage(locale, c.importError ?? "")}</span>
                </Link>
              </li>
            ))}
            {gitFailing.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="hover:text-accent-ink">
                  <b>{p.name}</b> <span className="text-muted">– {translateMessage(locale, p.repoCache?.error ?? "")}</span>
                </Link>
              </li>
            ))}
            {gitFailingCount > gitFailing.length && <li className="text-muted">{tgit("problems.more", { n: gitFailingCount - gitFailing.length })}</li>}
          </ul>
        </section>
      )}
      <WeeklySuggestions initial={suggestions} />
      <SleepingProjects items={sleeping} />
      <ProjectBoard initial={projects.map((p) => serializeProject(p, done.get(p.id)))} greeting={displayNameOf(user)} />
      <SharedProjects
        projects={shared.map((p) => ({
          id: p.id,
          name: p.name,
          summary: p.summary,
          status: p.status,
          progress: p.progress,
          accent: p.accent,
          owner: displayNameOf(p.owner),
          role: p.members[0]?.role ?? "VIEWER",
        }))}
      />
      {buried > 0 && (
        <p className="mt-8 text-center text-sm">
          <Link href="/graveyard" className="text-muted hover:text-fg">{tg("page.link", { n: buried })}</Link>
        </p>
      )}
    </>
  );
}
