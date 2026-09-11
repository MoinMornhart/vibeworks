import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { appLink, deliver, hasChannel, notificationView, storeInbox } from "@/lib/notify";
import type { Notice } from "@/lib/notify/format";
import { getT } from "@/lib/i18n/server";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Testnachricht: immer in den Posteingang (Windows-App), dazu an alle
// eingetragenen Kanäle – mit Ergebnis je Kanal.
export const POST = route(async () => {
  const user = await requireApiUser();
  limitOrThrow(`notify-test:${user.id}`, 10, 10 * MINUTE);
  const s = await db.notificationSettings.findUnique({ where: { userId: user.id } });
  const t = await getT("notify");
  const notice: Notice = { event: "test", title: t("events.test.title"), message: t("events.test.message"), url: appLink("/account") };
  await storeInbox(user.id, notice);
  const results = s && hasChannel(s) ? await deliver(s, notice) : [];
  const fresh = await db.notificationSettings.findUnique({ where: { userId: user.id } });
  return json({ results, settings: notificationView(fresh) });
});
