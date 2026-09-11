import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { currentEntry, stopRunning } from "@/lib/timeServer";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const schema = z.object({
  taskId: z.string().min(1).max(40),
  // Fokus-Timer: 5–120 Minuten; ohne Angabe läuft die Stoppuhr
  focusMinutes: z.number().int().min(5).max(120).nullish(),
});

// Timer für eine Aufgabe starten – ein laufender wird vorher beendet.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`time:${user.id}`, 120, MINUTE);
  const { taskId, focusMinutes } = await readBody(req, schema, { maxBytes: 1024 });
  const { task } = await requireTask(user.id, taskId);
  await stopRunning(user.id);
  await db.timeEntry.create({ data: { userId: user.id, projectId: task.projectId, taskId, focusMinutes: focusMinutes ?? null } });
  return json({ current: await currentEntry(user.id) }, { status: 201 });
});
