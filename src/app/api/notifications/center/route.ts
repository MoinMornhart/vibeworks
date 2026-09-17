import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { notificationCenter, saveRules } from "@/lib/notify/center";
import { NOTIFY_EVENTS } from "@/lib/notify/format";
import { MAX_RULE_ITEMS, readRules } from "@/lib/notify/rulesLogic";

// Meldungen-Seite (#109): Liste mit Filtern, eigene Regeln speichern.

const rulesSchema = z.object({
  words: z.array(z.string().trim().min(1).max(60)).max(MAX_RULE_ITEMS),
  people: z.array(z.string().trim().min(1).max(60)).max(MAX_RULE_ITEMS),
  projects: z.array(z.string().min(1).max(40)).max(MAX_RULE_ITEMS),
});

export const GET = route(async (req) => {
  const user = await requireApiUser();
  const p = req.nextUrl.searchParams;
  const event = p.get("event");
  return json({
    center: await notificationCenter(user.id, {
      q: p.get("q") ?? "",
      event: (NOTIFY_EVENTS as readonly string[]).includes(event ?? "") ? (event as (typeof NOTIFY_EVENTS)[number]) : null,
      unreadOnly: p.get("unread") === "1",
      limit: Number(p.get("limit")) || undefined,
    }),
  });
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, rulesSchema, { maxBytes: 16_000 });
  await saveRules(user.id, readRules(input));
  return json({ center: await notificationCenter(user.id) });
});
