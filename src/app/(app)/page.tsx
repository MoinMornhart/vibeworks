import Link from "next/link";
import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject, taskDoneCounts } from "@/lib/projects";
import { AWAKE_STATUSES, lastSign, SLEEP_DAYS } from "@/lib/grave";
import { getT } from "@/lib/i18n/server";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { PendingRequests, SharedProjects } from "@/components/share/SharedProjects";
import { SleepingProjects } from "@/components/grave/SleepingProjects";

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
