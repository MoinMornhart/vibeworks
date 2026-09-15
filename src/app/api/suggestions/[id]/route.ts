import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { createTask } from "@/lib/actions";
import { getLocale, getT } from "@/lib/i18n/server";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { taskCreateSchema } from "@/lib/validation";
import { dayKey } from "@/lib/utils";
import { dayKeyToDate } from "@/lib/taskDates";
import { SNOOZE_DAYS } from "@/lib/grave";
import { MAX_FOCUS } from "@/lib/today";
import { acceptAction, isSuggestionKind, suggestionVars } from "@/lib/suggestionsLogic";
import { serializeSuggestion } from "@/lib/suggestions";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };
const bodySchema = z.object({ action: z.enum(["accept", "dismiss"]) });

/** Vorschlag annehmen (Aufgabe anlegen, für heute vormerken oder weitermachen) oder ablehnen. */
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`suggestion:${user.id}`, 60, MINUTE);
  const { action } = await readBody(req, bodySchema, { maxBytes: 512 });
  const s = await db.suggestion.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!s || !isSuggestionKind(s.kind)) throw notFound(tk("suggestions", "errors.notFound"));
  if (s.status !== "OPEN") throw new ApiError(409, tk("suggestions", "errors.decided"));

  if (action === "dismiss") {
    const updated = await db.suggestion.update({ where: { id: s.id }, data: { status: "DISMISSED", decidedAt: new Date() } });
    return json({ suggestion: serializeSuggestion(updated) });
  }

  let taskId: string | null = null;
  const kind = s.kind;
  switch (acceptAction(kind)) {
    case "task": {
      if (!s.projectId) throw notFound(tk("projects", "errors.notFound"));
      await requireProject(user.id, s.projectId, "EDITOR");
      const t = await getT("suggestions");
      const locale = await getLocale();
      const data = (s.data ?? {}) as Record<string, string | number>;
      const vars = suggestionVars(data, locale, (x) => translateMessage(locale, x));
      const input = taskCreateSchema.parse({
        title: t(`kinds.${kind}.task`, vars).slice(0, 200),
        description: `${t(`kinds.${kind}.detail`, vars)}\n\n_${t("fromSuggestions")}_`,
        labels: ["vorschlag"],
        ...(kind === "renewal" && typeof data.date === "string" ? { dueDate: data.date } : {}),
      });
      taskId = (await createTask(user.id, s.projectId, input)).task.id;
      break;
    }
    case "today": {
      // Überfällige Aufgaben (in Projekten, die man bearbeiten darf) für heute vormerken
      const today = dayKey(new Date());
      const tasks = await db.task.findMany({
        where: {
          status: { not: "DONE" },
          dueDate: { lt: dayKeyToDate(today) },
          project: { buriedAt: null, status: { not: "ARCHIVED" }, OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id, role: "EDITOR" } } },
              { teams: { some: { role: "EDITOR", team: { members: { some: { userId: user.id } } } } } },
            ],
          },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
        select: { id: true },
      });
      let position = await db.taskFocus.count({ where: { userId: user.id, day: today } });
      for (const task of tasks) {
        if (position >= MAX_FOCUS) break;
        await db.taskFocus.upsert({
          where: { userId_taskId_day: { userId: user.id, taskId: task.id, day: today } },
          create: { userId: user.id, taskId: task.id, day: today, position: position++ },
          update: {},
        });
      }
      break;
    }
    case "continue": {
      if (!s.projectId) throw notFound(tk("projects", "errors.notFound"));
      await requireProject(user.id, s.projectId, "EDITOR");
      // Wie „Weitermachen“ beim Friedhof: zählt als Lebenszeichen, 30 Tage keine Nachfrage
      await db.project.update({ where: { id: s.projectId }, data: { nudgeSnoozedUntil: new Date(Date.now() + SNOOZE_DAYS * 86_400_000) } });
      break;
    }
  }
  const updated = await db.suggestion.update({ where: { id: s.id }, data: { status: "ACCEPTED", decidedAt: new Date(), taskId } });
  return json({ suggestion: serializeSuggestion(updated) });
});
