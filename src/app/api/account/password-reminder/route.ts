import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { REMINDER_OPTIONS } from "@/lib/auth/passwordAge";

const schema = z.object({ days: z.number().int().refine((d) => (REMINDER_OPTIONS as readonly number[]).includes(d)) });

// Nach wie vielen Tagen an einen Passwortwechsel erinnert wird (0 = nie).
export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  const { days } = await readBody(req, schema, { maxBytes: 64 });
  await db.user.update({ where: { id: user.id }, data: { passwordReminderDays: days, passwordRemindedAt: null } });
  return json({ days });
});
