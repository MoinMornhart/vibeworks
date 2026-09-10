import { db } from "@/lib/db";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { projectListSelect, serializeProject } from "@/lib/projects";
import { ProjectBoard } from "@/components/projects/ProjectBoard";

export default async function Dashboard() {
  const user = await requirePageUser();
  const projects = await db.project.findMany({
    where: { ownerId: user.id },
    select: projectListSelect,
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
  });
  return <ProjectBoard initial={projects.map(serializeProject)} greeting={displayNameOf(user)} />;
}
