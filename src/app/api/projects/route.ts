import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { projectCreateWithTemplateSchema } from "@/lib/validation";
import { nextPosition, projectListSelect, serializeProject, taskDoneCounts, uniqueSlug } from "@/lib/projects";
import { applyTemplate, resolveTemplate } from "@/lib/templates";
import { getLocale } from "@/lib/i18n/server";
import { tk } from "@/lib/i18n/messages";
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
  const { templateId, ...input } = await readBody(req, projectCreateWithTemplateSchema);
  // Vorlage vor dem Anlegen auflösen – eine unbekannte soll kein halbes Projekt hinterlassen.
  const template = templateId ? await resolveTemplate(user.id, await getLocale(), templateId) : null;
  if (templateId && !template) throw new ApiError(400, tk("data", "errors.templateNotFound"));

  const created = await db.project.create({
    data: {
      ...input,
      ownerId: user.id,
      slug: await uniqueSlug(user.id, input.name),
      position: await nextPosition(user.id, input.status),
    },
    select: { id: true, name: true },
  });
  if (template) await applyTemplate(created.id, template);
  await logActivity({ projectId: created.id, userId: user.id, kind: "PROJECT_CREATED", summary: `Projekt „${created.name}“ angelegt`, meta: { name: created.name } });
  const project = await db.project.findUniqueOrThrow({ where: { id: created.id }, select: projectListSelect });
  return json({ project: serializeProject(project) }, { status: 201 });
});
