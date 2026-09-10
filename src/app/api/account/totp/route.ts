import QRCode from "qrcode";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { config } from "@/lib/config";
import { decrypt, encrypt } from "@/lib/crypto";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { recoveryCodesLeft, replaceRecoveryCodes } from "@/lib/auth/recovery";
import { confirmIdentity } from "@/lib/auth/mfa";
import { confirmIdentitySchema, totpCodeSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ enabled: Boolean(user.totpEnabledAt), recoveryLeft: await recoveryCodesLeft(user.id) });
});

// Einrichtung beginnen: Schlüssel erzeugen und hinterlegen – scharf wird er
// erst mit einem bestätigten Code (PUT), damit sich niemand aussperrt, der
// den QR-Code nicht richtig eingelesen hat.
export const POST = route(async () => {
  const user = await requireApiUser();
  if (user.totpEnabledAt) throw new ApiError(409, "Zwei-Faktor ist bereits eingerichtet.");
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encrypt(secret), totpLastStep: null } });
  const uri = otpauthUri(secret, user.username, config.appName);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return json({ secret, uri, qr });
});

// Einrichtung bestätigen – erst jetzt ist der zweite Faktor aktiv.
export const PUT = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`totp-setup:${user.id}`, 10, 10 * MINUTE);
  const { code } = await readBody(req, totpCodeSchema);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabledAt: true } });
  if (row.totpEnabledAt) throw new ApiError(409, "Zwei-Faktor ist bereits eingerichtet.");
  if (!row.totpSecret) throw new ApiError(400, "Bitte die Einrichtung neu starten.");
  const step = verifyTotp(decrypt(row.totpSecret), code, null);
  if (step === null) throw new ApiError(400, "Der Code stimmt nicht – Uhrzeit des Handys prüfen und den aktuellen Code eingeben.", { code: "Stimmt nicht" });
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
  return json({ enabled: true, codes: await replaceRecoveryCodes(user.id) });
});

// Abschalten – verlangt Passwort (bzw. Code bei reinen Passkey-Konten).
export const DELETE = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`totp-confirm:${user.id}`, 10, 10 * MINUTE);
  await confirmIdentity(user.id, await readBody(req, confirmIdentitySchema));
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } }),
    db.recoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);
  return json({ enabled: false });
});
