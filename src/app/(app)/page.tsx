import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject, taskDoneCounts } from "@/lib/projects";
import { ProjectBoard } from "@/components/projects/ProjectBoard";

export default async function Dashboard() {
  const user = await requirePageUser();
  const [projects, done] = await Promise.all([
    db.project.findMany({
      where: { ownerId: user.id },
      select: projectListSelect,
      orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
    }),
    taskDoneCounts(user.id),
  ]);
  return <ProjectBoard initial={projects.map((p) => serializeProject(p, done.get(p.id)))} greeting={displayNameOf(user)} />;
}
