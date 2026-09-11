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

/** Ein Konto über einen Anlass benachrichtigen – sofern es ihn eingeschaltet und einen Kanal hat. */
export async function notifyUser(userId: string, event: NotifyEvent, build: (t: TFunction<"notify">, locale: Locale) => Notice): Promise<void> {
  try {
    const s = await db.notificationSettings.findUnique({ where: { userId }, include: { user: { select: { locale: true, active: true } } } });
    if (!s || !s.user.active || !eventsOf(s.events)[event]) return;
    if (!s.ntfyUrl && !s.webhookUrl && !s.email) return;
    const locale: Locale = isLocale(s.user.locale) ? s.user.locale : "de";
    await deliver(s, build(makeT(locale, "notify"), locale));
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
