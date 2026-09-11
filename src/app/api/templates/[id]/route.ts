import { db } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { listTemplates } from "@/lib/templates";
import { getLocale } from "@/lib/i18n/server";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.projectTemplate.deleteMany({ where: { id: (await params).id, ownerId: user.id } });
  if (!count) throw notFound(tk("data", "errors.templateNotFound"));
  return json(await listTemplates(user.id, await getLocale()));
});
