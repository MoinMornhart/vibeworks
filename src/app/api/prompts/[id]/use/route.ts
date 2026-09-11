import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";

type Params = { id: string };

// Beim Kopieren hochzählen – die meistgenutzten stehen oben. „Geändert“ bleibt.
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await db.$executeRaw`UPDATE "Prompt" SET "uses" = "uses" + 1 WHERE "id" = ${id} AND "userId" = ${user.id}`;
  return json({ ok: true });
});
