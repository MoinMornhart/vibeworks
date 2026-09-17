import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { config } from "@/lib/config";
import { decrypt, encrypt, randomToken, sha256 } from "@/lib/crypto";
import { makeT, tk } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/config";
import { storeInbox } from "@/lib/notify";
import { MAX_TOKENS, newApiToken } from "./token";
import { DEVICE_TTL_MS, deviceKeyName, newUserCode, normalizeUserCode, POLL_INTERVAL_S, pollResult } from "./deviceAuthLogic";
import type { KeyScope } from "./keySettings";

// Geräte-Anmeldung (#104) mit Datenbank. Öffentlich sind nur Start und
// Abholung – freigeben kann ausschließlich ein angemeldetes Konto.

const verificationUrl = () => `${config.appUrl}/verbinden`;
const mcpUrl = () => `${config.appUrl}/api/mcp`;

/** Offene Anfragen je Adresse – mehr braucht kein Programm. */
const MAX_PENDING_PER_IP = 5;

export async function startDevice(input: { clientName: string; scope: KeyScope; ip: string | null }) {
  const now = new Date();
  // Aufräumen: abgelaufene Anfragen samt nicht abgeholter Schlüssel-Kopien
  await db.deviceAuth.deleteMany({ where: { expiresAt: { lt: now } } });
  if (input.ip && (await db.deviceAuth.count({ where: { ip: input.ip, status: "pending" } })) >= MAX_PENDING_PER_IP) {
    throw new ApiError(429, "Too many open device requests from this address – finish or wait for the others.");
  }
  const deviceCode = randomToken(32);
  for (let attempt = 0; ; attempt++) {
    const userCode = newUserCode();
    try {
      await db.deviceAuth.create({
        data: { deviceCodeHash: sha256(deviceCode), userCode, clientName: input.clientName, scope: input.scope, ip: input.ip, expiresAt: new Date(now.getTime() + DEVICE_TTL_MS) },
      });
      return {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUrl(),
        verification_uri_complete: `${verificationUrl()}?code=${encodeURIComponent(userCode)}`,
        expires_in: DEVICE_TTL_MS / 1000,
        interval: POLL_INTERVAL_S,
        mcp_url: mcpUrl(),
      };
    } catch (err) {
      // Doppelter Code (sehr selten) – neuen würfeln
      if (attempt >= 3) throw err;
    }
  }
}

/** Nachfrage des Programms: Fehlercode oder – genau einmal – der Schlüssel. */
export async function pollDevice(deviceCode: string) {
  const row = await db.deviceAuth.findUnique({ where: { deviceCodeHash: sha256(deviceCode) } });
  const result = pollResult(row);
  if (row && result.kind === "error" && result.error !== "invalid_grant" && result.error !== "expired_token") {
    await db.deviceAuth.update({ where: { id: row.id }, data: { lastPollAt: new Date() } });
  }
  if (result.kind === "error" || !row?.tokenCipher) return { error: result.kind === "error" ? result.error : "invalid_grant" } as const;
  // Nur wer den Datensatz als Erster umstellt, bekommt den Schlüssel
  const { count } = await db.deviceAuth.updateMany({ where: { id: row.id, status: "approved" }, data: { status: "claimed", tokenCipher: null } });
  if (!count) return { error: "invalid_grant" } as const;
  return { access_token: decrypt(row.tokenCipher), token_type: "Bearer", scope: row.scope, mcp_url: mcpUrl() } as const;
}

/** Offene Anfrage zu einem eingetippten Code – für die Freigabe-Seite. */
export async function pendingByCode(input: string) {
  const code = normalizeUserCode(input);
  if (!code) return null;
  const row = await db.deviceAuth.findUnique({ where: { userCode: code } });
  if (!row || row.status !== "pending" || row.expiresAt.getTime() <= Date.now()) return null;
  return { code: row.userCode, clientName: row.clientName, scope: row.scope as KeyScope, ip: row.ip, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() };
}
export type PendingDevice = NonNullable<Awaited<ReturnType<typeof pendingByCode>>>;

export async function decideDevice(userId: string, input: { code: string; approve: boolean; scope?: KeyScope }) {
  const pending = await pendingByCode(input.code);
  if (!pending) throw new ApiError(404, tk("mcp", "device.notFound"));
  if (!input.approve) {
    await db.deviceAuth.updateMany({ where: { userCode: pending.code, status: "pending" }, data: { status: "denied", userId } });
    return { approved: false };
  }
  if ((await db.apiToken.count({ where: { userId } })) >= MAX_TOKENS) throw new ApiError(400, tk("mcp", "errors.limit", { n: MAX_TOKENS }));
  const scope = input.scope ?? pending.scope;
  const { token, hash, hint } = newApiToken();
  const key = await db.apiToken.create({ data: { userId, name: deviceKeyName(pending.clientName), tokenHash: hash, hint, scope } });
  const { count } = await db.deviceAuth.updateMany({
    where: { userCode: pending.code, status: "pending" },
    // Kurz vor Ablauf freigegeben? Zum Abholen bleiben mindestens zwei Minuten
    data: { status: "approved", userId, tokenId: key.id, scope, tokenCipher: encrypt(token), expiresAt: new Date(Math.max(Date.parse(pending.expiresAt), Date.now() + 2 * 60_000)) },
  });
  if (!count) {
    // Gleichzeitig anders entschieden oder abgelaufen – Schlüssel wieder weg
    await db.apiToken.delete({ where: { id: key.id } });
    throw new ApiError(409, tk("mcp", "device.notFound"));
  }
  // Immer in den Posteingang – ein neuer Zugang zum Konto soll nie unbemerkt bleiben
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const t = makeT(isLocale(user?.locale) ? user.locale : "de", "mcp");
  await storeInbox(userId, {
    event: "test",
    title: t("device.noticeTitle", { name: pending.clientName }),
    message: `${pending.clientName} · ${hint}${pending.ip ? ` · ${pending.ip}` : ""}`,
    url: "/account#mcp",
  });
  return { approved: true, keyId: key.id, scope };
}
