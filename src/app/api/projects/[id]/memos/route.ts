import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { addCodeMemo } from "@/lib/codeMemo";
import { projectMemos } from "@/lib/codeGraph";
import { memoCreateSchema } from "@/lib/codeMemoLogic";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Memo-Netz (#60): lesen darf, wer das Projekt sieht; schreiben, wer Notizen bearbeiten darf.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json({ memos: await projectMemos(project.id) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "notes.edit");
  limitOrThrow(`code-memo:${user.id}`, 60, 10 * MINUTE);
  const input = await readBody(req, memoCreateSchema, { maxBytes: 4096 });
  await addCodeMemo(user.id, project.id, input);
  return json({ memos: await projectMemos(project.id) }, { status: 201 });
});
