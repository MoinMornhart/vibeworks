import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { displayNameOf } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";
import { MAX_MEMOS } from "./codeMemoLogic";

// Memos im Code-Netz (#60) anlegen und löschen – für Oberfläche und MCP.

export async function addCodeMemo(userId: string, projectId: string, input: { file: string; text: string }, via: "web" | "mcp" = "web") {
  if ((await db.codeMemo.count({ where: { projectId } })) >= MAX_MEMOS) throw new ApiError(409, tk("graph", "memoLimit", { n: MAX_MEMOS }));
  const author = await db.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
  return db.codeMemo.create({ data: { projectId, file: input.file, text: input.text, authorId: userId, authorName: author ? displayNameOf(author) : null, via } });
}

export async function deleteCodeMemo(projectId: string, memoId: string) {
  const { count } = await db.codeMemo.deleteMany({ where: { id: memoId, projectId } });
  if (!count) throw new ApiError(404, tk("graph", "memoNotFound"));
}
