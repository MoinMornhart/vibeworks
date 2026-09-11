import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { getLocale } from "@/lib/i18n/server";
import { serializePrompt, STARTER_PROMPTS } from "@/lib/prompts";

const include = { project: { select: { id: true, name: true } } } as const;

// Beispiele in der Sprache des Kontos – was es mit gleichem Titel schon gibt, wird nicht doppelt angelegt.
export const POST = route(async () => {
  const user = await requireApiUser();
  const starters = STARTER_PROMPTS[await getLocale()];
  const existing = new Set((await db.prompt.findMany({ where: { userId: user.id }, select: { title: true } })).map((p) => p.title));
  const fresh = starters.filter((s) => !existing.has(s.title));
  if (fresh.length) await db.prompt.createMany({ data: fresh.map((s) => ({ ...s, userId: user.id })) });
  const prompts = await db.prompt.findMany({ where: { userId: user.id }, include, orderBy: [{ uses: "desc" }, { updatedAt: "desc" }] });
  return json({ added: fresh.length, prompts: prompts.map(serializePrompt) });
});
