import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { promptUpdateSchema } from "@/lib/validation";
import { serializePrompt } from "@/lib/prompts";

type Params = { id: string };
const include = { project: { select: { id: true, name: true } } } as const;

async function own(userId: string, id: string) {
  const prompt = await db.prompt.findFirst({ where: { id, userId } });
  if (!prompt) throw notFound(tk("prompts", "errors.notFound"));
  return prompt;
}

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await own(user.id, id);
  const input = await readBody(req, promptUpdateSchema, { maxBytes: 64 * 1024 });
  if (input.projectId) await requireProject(user.id, input.projectId);
  const prompt = await db.prompt.update({ where: { id }, data: input, include });
  return json({ prompt: serializePrompt(prompt) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await own(user.id, id);
  await db.prompt.delete({ where: { id } });
  return json({ ok: true });
});
