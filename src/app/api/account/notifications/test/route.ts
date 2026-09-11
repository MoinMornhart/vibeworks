import { db } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { appLink, deliver, notificationView } from "@/lib/notify";
import { getT } from "@/lib/i18n/server";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Testnachricht an alle eingetragenen Kanäle – mit Ergebnis je Kanal.
export const POST = route(async () => {
  const user = await requireApiUser();
  limitOrThrow(`notify-test:${user.id}`, 10, 10 * MINUTE);
  const s = await db.notificationSettings.findUnique({ where: { userId: user.id } });
  if (!s || (!s.ntfyUrl && !s.webhookUrl && !s.email)) throw new ApiError(400, tk("notify", "errors.noChannel"));
  const t = await getT("notify");
  const results = await deliver(s, { event: "test", title: t("events.test.title"), message: t("events.test.message"), url: appLink("/account") });
  const fresh = await db.notificationSettings.findUnique({ where: { userId: user.id } });
  return json({ results, settings: notificationView(fresh) });
});
