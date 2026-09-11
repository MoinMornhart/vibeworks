import { db } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.apiToken.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) throw notFound(tk("mcp", "errors.notFound"));
  return json({ ok: true });
});
