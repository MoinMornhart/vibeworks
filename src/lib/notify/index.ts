import type { NotificationSettings } from "@prisma/client";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { safeFetch } from "@/lib/security/ssrf";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { makeT, tk, type TFunction } from "@/lib/i18n/messages";
import { eventsOf, ntfyRequest, webhookBody, type Channel, type Notice, type NotifyEvent } from "./format";
import { sendMail } from "./mail";

// Versand an die Kanäle eines Kontos: ntfy, Webhook, E-Mail. Jede Nachricht
// wird in der Sprache des Empfängers gebaut. Fehler landen am Konto
// (lastError), nie beim Auslöser – eine Benachrichtigung darf nichts kaputtmachen.

export interface ChannelResult {
  channel: Channel;
  ok: boolean;
  error?: string;
}

export const appLink = (path: string) => `${config.appUrl}${path}`;

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "VibeWorks", ...headers },
    body: JSON.stringify(body),
    timeoutMs: 10_000,
  });
  if (!res.ok) throw new Error(tk("notify", "errors.http", { status: res.status }));
}

export async function deliver(s: NotificationSettings, notice: Notice): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];
  const attempt = async (channel: Channel, send: () => Promise<void>) => {
    try {
      await send();
      results.push({ channel, ok: true });
    } catch (err) {
      results.push({ channel, ok: false, error: err instanceof Error && err.message ? err.message : tk("notify", "errors.failed") });
    }
  };
  if (s.ntfyUrl) {
    await attempt("ntfy", async () => {
      const req = ntfyRequest(s.ntfyUrl!, notice, s.ntfyTokenCipher ? decrypt(s.ntfyTokenCipher) : null);
      if (!req) throw new Error(tk("notify", "errors.badNtfy"));
      await postJson(req.url, req.body, req.headers);
    });
  }
  if (s.webhookUrl) await attempt("webhook", () => postJson(s.webhookUrl!, webhookBody(s.webhookUrl!, notice)));
  if (s.email) await attempt("email", () => sendMail(s.email!, notice));

  const failed = results.find((r) => !r.ok);
  await db.notificationSettings.update({
    where: { userId: s.userId },
    data: { lastSentAt: new Date(), lastError: failed ? `${failed.channel}|${failed.error}` : null },
  });
  return results;
}

/** Posteingang – die Windows-App holt ihn ab und zeigt daraus Windows-Meldungen. */
export async function storeInbox(userId: string, n: Notice): Promise<void> {
  await db.notification.create({ data: { userId, event: n.event, title: n.title.slice(0, 300), message: n.message.slice(0, 4000), url: n.url } });
}

export const hasChannel = (s: NotificationSettings) => Boolean(s.ntfyUrl || s.webhookUrl || s.email);

/**
 * Ein Konto über einen Anlass benachrichtigen – sofern es ihn nicht
 * ausgeschaltet hat: immer in den Posteingang, dazu an die eingetragenen Kanäle.
 */
export async function notifyUser(userId: string, event: NotifyEvent, build: (t: TFunction<"notify">, locale: Locale) => Notice): Promise<void> {
  try {
    const [s, user] = await Promise.all([
      db.notificationSettings.findUnique({ where: { userId } }),
      db.user.findUnique({ where: { id: userId }, select: { locale: true, active: true } }),
    ]);
    if (!user?.active || (s && !eventsOf(s.events)[event])) return;
    const locale: Locale = isLocale(user.locale) ? user.locale : "de";
    const notice = build(makeT(locale, "notify"), locale);
    await storeInbox(userId, notice);
    if (s && hasChannel(s)) await deliver(s, notice);
  } catch (err) {
    console.error("[notify]", event, err);
  }
}

export function notificationView(s: NotificationSettings | null) {
  return {
    ntfyUrl: s?.ntfyUrl ?? "",
    hasNtfyToken: Boolean(s?.ntfyTokenCipher),
    webhookUrl: s?.webhookUrl ?? "",
    email: s?.email ?? "",
    events: eventsOf(s?.events),
    lastError: s?.lastError ?? null,
    lastSentAt: s?.lastSentAt?.toISOString() ?? null,
  };
}
export type NotificationView = ReturnType<typeof notificationView>;
