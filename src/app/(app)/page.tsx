import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject, taskDoneCounts } from "@/lib/projects";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { PendingRequests, SharedProjects } from "@/components/share/SharedProjects";

export default async function Dashboard() {
  const user = await requirePageUser();
  const [projects, done, shared, requests] = await Promise.all([
    db.project.findMany({
      where: { ownerId: user.id },
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
  ]);
  return (
    <>
      <PendingRequests
        items={requests.map((r) => ({ id: r.id, projectId: r.project.id, projectName: r.project.name, name: displayNameOf(r.user), role: r.role }))}
      />
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
    </>
  );
}
