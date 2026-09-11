import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { listTemplates, MAX_OWN_TEMPLATES, snapshotProject } from "@/lib/templates";
import { templateCreateSchema } from "@/lib/validation";
import { getLocale } from "@/lib/i18n/server";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json(await listTemplates(user.id, await getLocale()));
});

// Ein Projekt als eigene Vorlage speichern – jedes Mitglied darf das, die
// Vorlage gehört dann ihm selbst.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`template:${user.id}`, 30, 10 * MINUTE);
  const { projectId, name, description } = await readBody(req, templateCreateSchema);
  await requireProject(user.id, projectId);
  if ((await db.projectTemplate.count({ where: { ownerId: user.id } })) >= MAX_OWN_TEMPLATES) {
    throw new ApiError(400, tk("data", "errors.tooManyTemplates"));
  }
  const data = await snapshotProject(projectId);
  await db.projectTemplate.create({ data: { ownerId: user.id, name, description: description || null, data } });
  return json(await listTemplates(user.id, await getLocale()), { status: 201 });
});
