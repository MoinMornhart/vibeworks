import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/clientIp";
import { randomToken, sha256 } from "@/lib/crypto";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/messages";
import { appLink, notifyUser } from "@/lib/notify";
import { sendMail, smtpReady } from "@/lib/notify/mail";

// Notfallwege beim zweiten Faktor (#109): ein Code per E-Mail, wenn der
// Authenticator weg ist, und nach jeder Anmeldung über einen Notfallweg die
// Nachfrage „Warst du das?“ – mit einem Link, der alle Sitzungen beendet.

export const MFA_EMAIL_CODE_MINUTES = 10;
/** Erst nach dieser Zeit lässt sich ein neuer Code anfordern. */
const MFA_EMAIL_RESEND_MS = 60_000;
const CHECK_DAYS = 7;

export type LoginMethod = "recovery" | "email";

const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const codeHash = (code: string) => sha256(`vw-mfa-mail:${code.replace(/\D/g, "")}`);

/** Kann dieses Konto den Notfall-Code per E-Mail bekommen? */
async function mfaEmailPossible(user: { email: string | null; mfaEmail: boolean }): Promise<boolean> {
  return Boolean(user.mfaEmail && user.email) && (await smtpReady());
}

const localeOf = (value: string | null): Locale => (isLocale(value) ? value : "de");

/**
 * Sechsstelligen Code an die hinterlegte Adresse schicken und am offenen
 * Anmeldeschritt merken. Liefert false, wenn der Weg nicht offensteht.
 */
export async function sendMfaEmailCode(pending: { id: string; emailCodeAt: Date | null; user: { id: string; email: string | null; mfaEmail: boolean; locale: string | null } }): Promise<boolean> {
  const { user } = pending;
  if (!(await mfaEmailPossible(user))) return false;
  if (pending.emailCodeAt && Date.now() - pending.emailCodeAt.getTime() < MFA_EMAIL_RESEND_MS) return true;
  const code = sixDigits();
  await db.mfaPending.update({ where: { id: pending.id }, data: { emailCodeHash: codeHash(code), emailCodeAt: new Date() } });
  const t = makeT(localeOf(user.locale), "auth");
  await sendMail(user.email!, {
    event: "test",
    title: t("mfa.mail.subject"),
    message: t("mfa.mail.body", { code, n: MFA_EMAIL_CODE_MINUTES }),
    url: null,
  });
  return true;
}

/** Prüft den Code aus der E-Mail – nur der zuletzt verschickte, nur frisch. */
export function checkMfaEmailCode(pending: { emailCodeHash: string | null; emailCodeAt: Date | null }, code: string): boolean {
  if (!pending.emailCodeHash || !pending.emailCodeAt) return false;
  if (Date.now() - pending.emailCodeAt.getTime() > MFA_EMAIL_CODE_MINUTES * 60_000) return false;
  return codeHash(code) === pending.emailCodeHash;
}

/**
 * Nach einer Anmeldung per Wiederherstellungscode oder E-Mail-Code: in die
 * Glocke und – wenn möglich – als E-Mail mit Link zum Bestätigen oder zum
 * Beenden aller Sitzungen.
 */
export async function alertLogin(user: { id: string; email: string | null; locale: string | null }, method: LoginMethod, req: NextRequest): Promise<void> {
  const token = randomToken(32);
  await db.loginCheck.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      method,
      ip: clientIp(req).slice(0, 60),
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200),
      expiresAt: new Date(Date.now() + CHECK_DAYS * 86_400_000),
    },
  });
  const url = appLink(`/anmeldung-pruefen?token=${encodeURIComponent(token)}`);
  await notifyUser(user.id, "loginAlert", (t) => ({
    event: "loginAlert",
    title: t(`events.loginAlert.title.${method}`),
    message: t("events.loginAlert.message"),
    url,
    priority: "urgent",
  }));
  if (user.email && (await smtpReady())) {
    const t = makeT(localeOf(user.locale), "auth");
    await sendMail(user.email, {
      event: "test",
      title: t(`mfa.alert.subject.${method}`),
      message: t("mfa.alert.body"),
      url,
    }).catch((err) => console.warn("[login-check] Mail:", err instanceof Error ? err.message : err));
  }
}

export interface LoginCheckView {
  method: LoginMethod;
  at: string;
  ip: string | null;
  userAgent: string | null;
  answer: string | null;
}

export async function readLoginCheck(token: string): Promise<LoginCheckView | null> {
  const row = await db.loginCheck.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return { method: row.method === "email" ? "email" : "recovery", at: row.createdAt.toISOString(), ip: row.ip, userAgent: row.userAgent, answer: row.answer };
}

/**
 * Antwort auf die Nachfrage. „revoked“ beendet alle Sitzungen des Kontos –
 * auch die, mit der gerade gearbeitet wird.
 */
export async function answerLoginCheck(token: string, answer: "ok" | "revoked"): Promise<LoginCheckView | null> {
  const row = await db.loginCheck.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.expiresAt.getTime() < Date.now() || row.answer) return null;
  await db.loginCheck.update({ where: { id: row.id }, data: { answer, answeredAt: new Date() } });
  if (answer === "revoked") await db.session.deleteMany({ where: { userId: row.userId } });
  return { method: row.method === "email" ? "email" : "recovery", at: row.createdAt.toISOString(), ip: row.ip, userAgent: row.userAgent, answer };
}
