import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { getLocale } from "@/lib/i18n/server";
import { taskFromError } from "@/lib/errorTasks";
import { tk } from "@/lib/i18n/messages";
import { serializeAppError, setErrorStatus } from "@/lib/bugs";
import { ERROR_STATUSES } from "@/lib/bugsLogic";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string; errorId: string };

const bodySchema = z.union([z.object({ status: z.enum(ERROR_STATUSES) }), z.object({ action: z.enum(["task", "notfix"]) })]);

async function find(projectId: string, errorId: string) {
  const e = await db.appError.findFirst({ where: { id: errorId, projectId } });
  if (!e) throw notFound(tk("bugs", "errors.notFound"));
  return e;
}

// Status setzen (offen, erledigt, ignoriert) oder eine Aufgabe daraus machen.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`bugs:${user.id}`, 60, MINUTE);
  const { id, errorId } = await params;
  const { perms } = await requireProject(user.id, id, "errors.manage");
  const e = await find(id, errorId);
  const body = await readBody(req, bodySchema, { maxBytes: 512 });
  if ("status" in body) return json({ item: serializeAppError(await setErrorStatus(e.id, body.status)) });
  // Eine Aufgabe daraus machen verlangt zusätzlich das Aufgaben-Recht
  if (!perms.has("tasks.edit")) throw new ApiError(403, tk("projects", "errors.viewOnly"));

  if (e.taskId && (await db.task.findFirst({ where: { id: e.taskId, projectId: id }, select: { id: true } }))) return json({ item: serializeAppError(e) });
  // „Notfix“ (#39): dieselbe Aufgabe, aber heute fällig, für Claude und deutlich gekennzeichnet.
  const updated = await taskFromError(user.id, e, { notfix: body.action === "notfix", locale: await getLocale() });
  return json({ item: serializeAppError(updated) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, errorId } = await params;
  await requireProject(user.id, id, "errors.manage");
  const e = await find(id, errorId);
  await db.appError.delete({ where: { id: e.id } });
  return json({ ok: true });
});
