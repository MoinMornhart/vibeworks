import { db } from "@/lib/db";
import { ApiError, clientIp, json, notFound, route } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";
import { addInboxItem } from "@/lib/inboxServer";
import { combineShared, MAX_INBOX_TEXT } from "@/lib/inbox";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { token: string };

// Einwurf-Adresse des Ideen-Eingangs – ohne Anmeldung, das Geheimnis steckt
// im Pfad. Nimmt JSON ({ text | message | title, url }), Formulare und
// reinen Text an: für Kurzbefehle, Tasker, Home Assistant, Mail-Weiterleitungen.
export const POST = route<Params>(async (req, { params }) => {
  const { token } = await params;
  limitOrThrow(`inbox-in-ip:${clientIp(req)}`, 60, 10 * MINUTE);
  if (!/^[\w-]{16,64}$/.test(token)) throw notFound();
  const user = await db.user.findUnique({ where: { inboxToken: token }, select: { id: true, active: true } });
  if (!user?.active) throw notFound();
  limitOrThrow(`inbox-in:${user.id}`, 30, 10 * MINUTE);

  const raw = await req.text();
  if (raw.length > MAX_INBOX_TEXT * 2) throw new ApiError(413, "errors.tooLarge");
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  let parts: { title?: string | null; text?: string | null; url?: string | null } = { text: raw };
  if (type.startsWith("application/json")) {
    try {
      const b = JSON.parse(raw) as Record<string, unknown>;
      const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : null);
      parts = { title: s("title") ?? s("subject"), text: s("text") ?? s("message") ?? s("body"), url: s("url") ?? s("link") };
    } catch {
      throw new ApiError(400, "errors.invalidJson");
    }
  } else if (type.startsWith("application/x-www-form-urlencoded")) {
    const f = new URLSearchParams(raw);
    parts = { title: f.get("title") ?? f.get("subject"), text: f.get("text") ?? f.get("message") ?? f.get("body"), url: f.get("url") };
  }
  const { text, url } = combineShared(parts);
  if (!text) throw new ApiError(400, tk("inbox", "errors.empty"));
  const item = await addInboxItem(user.id, { text, url, source: "webhook" });
  return json({ ok: true, id: item?.id ?? null }, { status: 201 });
});
