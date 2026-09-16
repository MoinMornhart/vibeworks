import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { issueContext } from "@/lib/git/issues";
import { BOT_MARKER, REPLY_MARKER } from "@/lib/git/botCommandsLogic";
import { GitError } from "@/lib/git/providers";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Unterhaltung im Issue einer Aufgabe (#76): lesen darf, wer das Projekt sieht;
// antworten, wer Aufgaben bearbeiten darf. Geschrieben wird über den
// Issue-Zugang (Bot, sonst Besitzer) – mit Namen der Person aus VibeWorks.

const replySchema = z.object({ text: z.string().trim().min(1).max(5000) });

const clean = (body: string) => body.replace(BOT_MARKER, "").replace(REPLY_MARKER, "").trim().slice(0, 4000);

async function contextFor(projectId: string) {
  const ctx = await issueContext(projectId);
  if (!ctx) throw new ApiError(400, tk("tasks", "info.conversation.noSync"));
  return ctx;
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { task } = await requireTask(user.id, (await params).id);
  if (!task.issueNumber) return json({ comments: [], issueUrl: null });
  limitOrThrow(`issue-comments:${user.id}`, 60, MINUTE);
  const ctx = await contextFor(task.projectId);
  try {
    const comments = await ctx.api.comments(task.issueNumber);
    return json({
      issueUrl: task.issueUrl,
      comments: comments.slice(-50).map((c) => ({
        id: c.id,
        author: c.author,
        body: clean(c.body),
        at: c.createdAt,
        url: c.url,
        bot: c.body.includes(BOT_MARKER),
        fromVibeWorks: c.body.includes(REPLY_MARKER),
      })),
    });
  } catch (err) {
    throw new ApiError(502, err instanceof GitError ? err.message : tk("git", "errors.issueFailed"));
  }
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { task } = await requireTask(user.id, (await params).id, "tasks.edit");
  if (!task.issueNumber) throw new ApiError(400, tk("tasks", "info.conversation.noIssue"));
  const { text } = await readBody(req, replySchema, { maxBytes: 12_000 });
  limitOrThrow(`issue-reply:${user.id}`, 20, 10 * MINUTE);
  const ctx = await contextFor(task.projectId);
  const author = await db.user.findUnique({ where: { id: user.id }, select: { username: true, displayName: true } });
  // Wer schreibt, steht sichtbar dabei – der Zugang gehört dem Bot bzw. dem Besitzer
  const body = `**${displayNameOf(author ?? user)}** (über VibeWorks):\n\n${text}\n\n${REPLY_MARKER}`;
  try {
    await ctx.api.comment(task.issueNumber, body);
  } catch (err) {
    throw new ApiError(502, err instanceof GitError ? err.message : tk("git", "errors.issueFailed"));
  }
  return json({ ok: true });
});
