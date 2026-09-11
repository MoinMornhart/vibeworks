import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { appLink } from "@/lib/notify";
import { sendMail } from "@/lib/notify/mail";
import { getT } from "@/lib/i18n/server";
import { tk } from "@/lib/i18n/messages";
import { smtpSettingsSchema, smtpTestSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// SMTP für Benachrichtigungen per E-Mail – nur für Admins. Das Passwort
// verlässt den Server nie wieder, angezeigt wird nur, ob es gesetzt ist.

function view(s: Awaited<ReturnType<typeof getSettings>>) {
  return { host: s.smtpHost ?? "", port: s.smtpPort ?? null, secure: s.smtpSecure, user: s.smtpUser ?? "", from: s.smtpFrom ?? "", hasPassword: Boolean(s.smtpPassCipher) };
}

export const GET = route(async () => {
  await requireApiAdmin();
  return json({ smtp: view(await getSettings()) });
});

export const PUT = route(async (req) => {
  await requireApiAdmin();
  const input = await readBody(req, smtpSettingsSchema, { maxBytes: 4096 });
  if ((input.host && !input.from) || (!input.host && input.from)) throw new ApiError(400, tk("notify", "errors.smtpIncomplete"));
  await getSettings();
  const updated = await db.settings.update({
    where: { id: "instance" },
    data: {
      smtpHost: input.host,
      smtpPort: input.port ?? null,
      smtpSecure: input.secure,
      smtpUser: input.user,
      smtpFrom: input.from,
      ...(input.password !== undefined ? { smtpPassCipher: input.password ? encrypt(input.password) : null } : {}),
    },
  });
  return json({ smtp: view(updated) });
});

// Test-Mail an eine Adresse – Fehler des SMTP-Servers kommen im Klartext zurück.
export const POST = route(async (req) => {
  await requireApiAdmin();
  limitOrThrow("smtp-test", 10, 10 * MINUTE);
  const { to } = await readBody(req, smtpTestSchema, { maxBytes: 1024 });
  const t = await getT("notify");
  try {
    await sendMail(to, { event: "test", title: t("events.test.title"), message: t("events.test.message"), url: appLink("/") });
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : tk("notify", "errors.failed"));
  }
  return json({ ok: true });
});
