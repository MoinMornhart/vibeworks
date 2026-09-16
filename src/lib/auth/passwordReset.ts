import { db } from "@/lib/db";
import { appLink } from "@/lib/notify";
import { sendMail, smtpReady } from "@/lib/notify/mail";
import { getSettings } from "@/lib/settings";
import { randomToken, sha256 } from "@/lib/crypto";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/messages";
import { hashPassword } from "./password";
import { destroyAllSessions } from "./session";
import { maskEmail, resetExpiry, resetUsable, RESET_MAX_PER_HOUR } from "./resetLogic";

// „Passwort vergessen“: Link an die hinterlegte Adresse. Gespeichert wird nur
// der SHA-256 des Tokens; der Link gilt eine Stunde und nur einmal. Ob es ein
// Konto zu einer Adresse gibt, verrät die API nie – die Antwort ist immer gleich.

export async function resetAllowed(): Promise<boolean> {
  const s = await getSettings();
  return s.allowPasswordReset && (await smtpReady());
}

/** Link anfordern. Wirft nie und sagt nichts darüber, ob es das Konto gibt. */
export async function requestReset(login: string, ip: string | null): Promise<void> {
  try {
    if (!(await resetAllowed())) return;
    const value = login.trim().toLowerCase();
    if (!value) return;
    const user = await db.user.findFirst({
      where: { active: true, OR: [{ username: value }, { email: { equals: value, mode: "insensitive" } }] },
      select: { id: true, username: true, email: true, locale: true },
    });
    if (!user?.email) return;
    const since = new Date(Date.now() - 60 * 60_000);
    if ((await db.passwordReset.count({ where: { userId: user.id, createdAt: { gte: since } } })) >= RESET_MAX_PER_HOUR) return;

    const token = randomToken(32);
    await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: resetExpiry(), ip: ip?.slice(0, 64) ?? null } });
    const locale: Locale = isLocale(user.locale) ? user.locale : "de";
    const t = makeT(locale, "auth");
    await sendMail(user.email, {
      event: "test",
      title: t("reset.mailTitle"),
      message: t("reset.mailText", { user: user.username }),
      url: appLink(`/reset?token=${token}`),
    });
  } catch (err) {
    console.error("[reset]", err);
  }
}

/** Konto zum Link – null, wenn unbekannt, abgelaufen oder schon benutzt. */
export async function resetTarget(token: string) {
  const row = await db.passwordReset.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, username: true, email: true, active: true } } },
  });
  if (!resetUsable(row) || !row?.user.active) return null;
  return { id: row.id, user: row.user, maskedEmail: row.user.email ? maskEmail(row.user.email) : null };
}

/** Neues Passwort setzen: Link verbrauchen, alle Sitzungen beenden, Datum merken. */
export async function completeReset(resetId: string, userId: string, password: string): Promise<void> {
  const { count } = await db.passwordReset.updateMany({ where: { id: resetId, usedAt: null }, data: { usedAt: new Date() } });
  if (!count) return;
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), passwordRemindedAt: null, failedLogins: 0, lockedUntil: null } });
  // Alte Links des Kontos entwerten und überall abmelden
  await db.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await destroyAllSessions(userId);
}
