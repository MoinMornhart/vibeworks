import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { createTask } from "@/lib/actions";
import { config } from "@/lib/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { tk } from "@/lib/i18n/messages";
import { taskCreateSchema } from "@/lib/validation";
import { serializeAppError, setErrorStatus } from "@/lib/bugs";
import { ERROR_STATUSES } from "@/lib/bugsLogic";
import { truncate } from "@/lib/utils";
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
  const t = await getT("bugs");
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" }).format(e.lastSeen);
  // Aufgaben können als Issue in ein (womöglich öffentliches) Repository wandern –
  // deshalb nur Nachricht und Anzahl, keine Stack-, Seiten- oder Client-Angaben.
  // Die Details bleiben im Fehler-Eingang, der Link führt dorthin.
  const description = [t("task.intro", { n: e.count, date }), "", `**${e.type ? `${e.type}: ` : ""}${e.message}**`, "", `${config.appUrl}/projects/${id}#fehler`].join("\n");
  // „Notfix“ (#39): dieselbe Aufgabe, aber heute fällig, für Claude und deutlich gekennzeichnet.
  const notfix = body.action === "notfix";
  const input = taskCreateSchema.parse({
    title: (notfix ? t("task.notfixTitle", { message: truncate(e.message, 110) }) : t("task.title", { message: truncate(e.message, 120) })).slice(0, 200),
    description: notfix ? [t("task.notfixIntro"), "", description].join("\n") : description,
    labels: notfix ? [t("task.label"), t("task.notfixLabel")] : [t("task.label")],
    ...(notfix ? { assignee: "Claude", priority: 4, dueDate: new Date().toISOString().slice(0, 10) } : {}),
  });
  const { task } = await createTask(user.id, id, input);
  const updated = await db.appError.update({ where: { id: e.id }, data: { taskId: task.id } });
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
