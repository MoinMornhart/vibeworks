import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { bellState } from "@/lib/notify/bell";

// Posteingang für die Windows-App: alles nach „after“ (ISO-Zeitpunkt), älteste
// zuerst. Ohne „after“ gibt es nur die Serverzeit – der Startpunkt fürs Abholen.
// Mit „list=1“: die neuesten Benachrichtigungen samt Zahl ungelesener (Glocke).
export const GET = route(async (req) => {
  const user = await requireApiUser();
  if (req.nextUrl.searchParams.get("list") === "1") return json(await bellState(user.id));
  // Wer abholt, bekommt auch die Morgen-Zusammenfassung – die läuft über die Einstellungen
  if (!(await db.notificationSettings.findUnique({ where: { userId: user.id }, select: { userId: true } }))) {
    await db.notificationSettings.create({ data: { userId: user.id } }).catch(() => undefined);
  }
  const now = new Date().toISOString();
  const raw = req.nextUrl.searchParams.get("after");
  const after = raw ? new Date(raw) : null;
  if (!after || Number.isNaN(after.getTime())) return json({ items: [], now });
  const items = await db.notification.findMany({ where: { userId: user.id, createdAt: { gt: after } }, orderBy: { createdAt: "asc" }, take: 20 });
  return json({
    items: items.map((n) => ({ id: n.id, event: n.event, title: n.title, message: n.message, url: n.url, createdAt: n.createdAt.toISOString() })),
    now,
  });
});

// Mehrere auf einmal (#109): ausgewählte gelesen/ungelesen/löschen oder alle löschen
const bulkSchema = z.union([
  z.object({ action: z.enum(["read", "unread", "delete"]), ids: z.array(z.string().min(1).max(40)).min(1).max(500) }),
  z.object({ action: z.literal("deleteAll") }),
]);

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const body = await readBody(req, bulkSchema, { maxBytes: 32_000 });
  const mine = body.action === "deleteAll" ? { userId: user.id } : { userId: user.id, id: { in: body.ids } };
  let count = 0;
  if (body.action === "delete" || body.action === "deleteAll") ({ count } = await db.notification.deleteMany({ where: mine }));
  else ({ count } = await db.notification.updateMany({ where: mine, data: { readAt: body.action === "read" ? new Date() : null } }));
  return json({ ...(await bellState(user.id)), count });
});

// Alle als gelesen markieren
export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  await readBody(req, z.object({ read: z.literal(true) }), { maxBytes: 64 });
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return json(await bellState(user.id));
});
