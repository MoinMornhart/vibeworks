import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { deleteCodeMemo } from "@/lib/codeMemo";
import { projectMemos } from "@/lib/codeGraph";

type Params = { id: string; memoId: string };

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, memoId } = await params;
  const { project } = await requireProject(user.id, id, "notes.edit");
  await deleteCodeMemo(project.id, memoId);
  return json({ memos: await projectMemos(project.id) });
});
