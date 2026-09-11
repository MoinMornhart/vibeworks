import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { projectCreateSchema } from "@/lib/validation";
import { nextPosition, projectListSelect, serializeProject, taskDoneCounts, uniqueSlug } from "@/lib/projects";
import { logActivity } from "@/lib/activity";

export const GET = route(async (req) => {
  const user = await requireApiUser();
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  const projects = await db.project.findMany({
    where: { ownerId: user.id, ...(archived ? {} : { status: { not: "ARCHIVED" } }) },
    select: projectListSelect,
    orderBy: { updatedAt: "desc" },
  });
  const done = await taskDoneCounts(user.id);
  return json({ projects: projects.map((p) => serializeProject(p, done.get(p.id))) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, projectCreateSchema);
  const project = await db.project.create({
    data: {
      ...input,
      ownerId: user.id,
      slug: await uniqueSlug(user.id, input.name),
      position: await nextPosition(user.id, input.status),
    },
    select: projectListSelect,
  });
  await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_CREATED", summary: `Projekt „${project.name}“ angelegt` });
  return json({ project: serializeProject(project) }, { status: 201 });
});
