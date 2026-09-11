import nodemailer from "nodemailer";
import { getSettings } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import type { Notice } from "./format";

// E-Mail über den SMTP-Server, den ein Admin für die ganze Instanz einträgt.

export async function smtpReady(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s.smtpHost && s.smtpFrom);
}

async function transport() {
  const s = await getSettings();
  if (!s.smtpHost || !s.smtpFrom) return null;
  return {
    from: s.smtpFrom,
    mailer: nodemailer.createTransport({
      host: s.smtpHost,
      port: s.smtpPort ?? (s.smtpSecure ? 465 : 587),
      secure: s.smtpSecure,
      auth: s.smtpUser ? { user: s.smtpUser, pass: s.smtpPassCipher ? decrypt(s.smtpPassCipher) : "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    }),
  };
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendMail(to: string, n: Notice): Promise<void> {
  const smtp = await transport();
  if (!smtp) throw new Error(tk("notify", "errors.noSmtp"));
  await smtp.mailer.sendMail({
    from: smtp.from,
    to,
    subject: n.title,
    text: [n.message, n.url].filter(Boolean).join("\n\n"),
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px;font-size:18px">${escape(n.title)}</h2>
<p style="white-space:pre-line;line-height:1.5">${escape(n.message)}</p>
${n.url ? `<p><a href="${escape(n.url)}" style="color:#8b5cf6">${escape(n.url)}</a></p>` : ""}
<p style="color:#888;font-size:12px;margin-top:24px">VibeWorks</p>
</div>`,
  });
}
