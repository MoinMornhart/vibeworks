import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { todayFocusSchema } from "@/lib/validation";
import { MAX_FOCUS } from "@/lib/today";
import { dayKey } from "@/lib/utils";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Aufgabe für heute vormerken / wieder herausnehmen. Gilt je Konto und Tag –
// in geteilten Projekten kommen sich zwei Leute nicht in die Quere.

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`today:${user.id}`, 120, MINUTE);
  const { taskId } = await readBody(req, todayFocusSchema, { maxBytes: 1024 });
  await requireTask(user.id, taskId, "EDITOR");
  const today = dayKey(new Date());
  // Gestern ist vorbei
  await db.taskFocus.deleteMany({ where: { userId: user.id, day: { lt: today } } });
  const count = await db.taskFocus.count({ where: { userId: user.id, day: today, taskId: { not: taskId } } });
  if (count >= MAX_FOCUS) throw new ApiError(400, tk("today", "errors.full", { n: MAX_FOCUS }));
  await db.taskFocus.upsert({
    where: { userId_taskId_day: { userId: user.id, taskId, day: today } },
    create: { userId: user.id, taskId, day: today, position: count },
    update: {},
  });
  return json({ ok: true }, { status: 201 });
});

export const DELETE = route(async (req) => {
  const user = await requireApiUser();
  const taskId = req.nextUrl.searchParams.get("taskId") ?? "";
  await db.taskFocus.deleteMany({ where: { userId: user.id, taskId, day: dayKey(new Date()) } });
  return json({ ok: true });
});
