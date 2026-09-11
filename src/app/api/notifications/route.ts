import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";

// Posteingang für die Windows-App: alles nach „after“ (ISO-Zeitpunkt), älteste
// zuerst. Ohne „after“ gibt es nur die Serverzeit – der Startpunkt fürs Abholen.
export const GET = route(async (req) => {
  const user = await requireApiUser();
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
