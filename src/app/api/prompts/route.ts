import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { promptSchema } from "@/lib/validation";
import { MAX_PROMPTS, serializePrompt } from "@/lib/prompts";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const PROMPT_INCLUDE ={ project: { select: { id: true, name: true } } } as const;

export const GET = route(async () => {
  const user = await requireApiUser();
  const prompts = await db.prompt.findMany({ where: { userId: user.id }, include: PROMPT_INCLUDE, orderBy: [{ uses: "desc" }, { updatedAt: "desc" }] });
  return json({ prompts: prompts.map(serializePrompt) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`prompt:${user.id}`, 60, 10 * MINUTE);
  const input = await readBody(req, promptSchema, { maxBytes: 64 * 1024 });
  if (input.projectId) await requireProject(user.id, input.projectId);
  if ((await db.prompt.count({ where: { userId: user.id } })) >= MAX_PROMPTS) throw new ApiError(400, tk("prompts", "errors.limit", { n: MAX_PROMPTS }));
  const prompt = await db.prompt.create({ data: { ...input, userId: user.id }, include: PROMPT_INCLUDE });
  return json({ prompt: serializePrompt(prompt) }, { status: 201 });
});
