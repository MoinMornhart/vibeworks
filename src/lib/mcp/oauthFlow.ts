import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { config } from "@/lib/config";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { makeT, tk } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/config";
import { storeInbox } from "@/lib/notify";
import { MAX_TOKENS, newApiToken } from "./token";
import { OAUTH_TTL_MS, newAuthorizationCode, newClientId, oauthReturnUrl, s256Challenge, tokenResult } from "./oauthFlowLogic";
import type { KeyScope } from "./keySettings";

// OAuth-Abläufe (#141) mit Datenbank, parallel zur Geräte-Anmeldung (#104):
// Registrierung und Autorisierung sind öffentlich (das Programm startet sie),
// freigeben kann nur ein angemeldetes Konto auf /verbinden. Der Schlüssel
// geht genau einmal und nur gegen den richtigen PKCE-Verifier raus.

/** Offene Abläufe je Adresse – mehr braucht kein Programm. */
const MAX_PENDING_PER_IP = 5;

/** Dynamische Client-Registrierung (RFC 7591) – alles flüchtig, kein Konto nötig. */
export async function registerClient(input: { client_name: string; redirect_uris: string[] }, ip: string | null) {
  const now = new Date();
  await db.oAuthFlow.deleteMany({ where: { expiresAt: { lt: now } } });
  if (ip && (await db.oAuthFlow.count({ where: { ip, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } } })) >= MAX_PENDING_PER_IP * 4) {
    throw new ApiError(429, "Too many client registrations from this address – try again later.");
  }
  const clientId = newClientId();
  // Der Client ist flüchtig: mit dem ersten Ablauf nach 10 Minuten weg. Für die
  // Autorisierung reicht das – registrieren und sofort autorisieren gehört zusammen.
  return { client_id: clientId, client_id_issued_at: Math.floor(now.getTime() / 1000), client_name: input.client_name, redirect_uris: input.redirect_uris, token_endpoint_auth_method: "none" };
}

/** Autorisierung starten: Code anlegen, Mensch auf /verbinden schicken. */
export async function startAuthorization(input: { clientId: string; clientName: string; redirectUri: string; scope: KeyScope; codeChallenge: string; state: string | null; ip: string | null }) {
  const code = newAuthorizationCode();
  await db.oAuthFlow.create({
    data: {
      clientId: input.clientId,
      clientName: input.clientName,
      codeHash: sha256(code),
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      redirectUri: input.redirectUri,
      state: input.state,
      ip: input.ip,
      expiresAt: new Date(Date.now() + OAUTH_TTL_MS),
    },
  });
  // Der Mensch sieht nur den Freigabe-Auftrag – der state des Programms bleibt
  // serverseitig gemerkt und kommt erst auf der Rückkehr mit
  const url = new URL(`${config.appUrl}/verbinden`);
  url.searchParams.set("oauth", code);
  return url.toString();
}

/** Freigabe-Auftrag zu einem Code lesen – für die Seite /verbinden. */
export async function pendingByOAuthCode(input: string) {
  if (input.length < 10 || input.length > 128) return null;
  const row = await db.oAuthFlow.findUnique({ where: { codeHash: sha256(input) } });
  if (!row || row.status !== "pending" || row.expiresAt.getTime() <= Date.now()) return null;
  // redirectUri und state wandern mit: die Seite zeigt sie an und nach der
  // Freigabe kehrt der Browser dorthin zurück – sonst hängt ChatGPT ewig
  return { code: input, clientId: row.clientId, clientName: row.clientName, scope: row.scope as KeyScope, redirectUri: row.redirectUri, state: row.state, ip: row.ip, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() };
}
export type PendingOAuth = NonNullable<Awaited<ReturnType<typeof pendingByOAuthCode>>>;

/** Freigeben oder ablehnen – wie decideDevice, aber für den OAuth-Code. */
export async function decideOAuth(userId: string, input: { code: string; approve: boolean; scope?: KeyScope }) {
  const pending = await pendingByOAuthCode(input.code);
  if (!pending) throw new ApiError(404, tk("mcp", "device.notFound"));
  if (!input.approve) {
    await db.oAuthFlow.updateMany({ where: { codeHash: sha256(pending.code), status: "pending" }, data: { status: "denied", userId } });
    // Auch bei Ablehnung zurück zum Programm – dort erscheint access_denied
    return { approved: false, returnTo: oauthReturnUrl(pending.redirectUri, null, pending.state) };
  }
  if ((await db.apiToken.count({ where: { userId } })) >= MAX_TOKENS) throw new ApiError(400, tk("mcp", "errors.limit", { n: MAX_TOKENS }));
  const scope = input.scope ?? pending.scope;
  const { token, hash, hint } = newApiToken();
  const key = await db.apiToken.create({ data: { userId, name: pending.clientName.slice(0, 60), tokenHash: hash, hint, scope } });
  const { count } = await db.oAuthFlow.updateMany({
    where: { codeHash: sha256(pending.code), status: "pending" },
    data: { status: "approved", userId, tokenId: key.id, scope, tokenCipher: encrypt(token), expiresAt: new Date(Math.max(Date.parse(pending.expiresAt), Date.now() + 5 * 60_000)) },
  });
  if (!count) {
    await db.apiToken.delete({ where: { id: key.id } });
    throw new ApiError(409, tk("mcp", "device.notFound"));
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const t = makeT(isLocale(user?.locale) ? user.locale : "de", "mcp");
  await storeInbox(userId, {
    event: "test",
    title: t("device.noticeTitle", { name: pending.clientName }),
    message: `${pending.clientName} · ${hint}${pending.ip ? ` · ${pending.ip}` : ""}`,
    url: "/account#mcp",
  });
  // Der Browser kehrt zum Programm zurück – mit Code (dorthin gehört er, nicht
  // in die Freigabe-Antwort) und dem state des Programms
  return { approved: true, keyId: key.id, scope, returnTo: oauthReturnUrl(pending.redirectUri, pending.code, pending.state) };
}

/** Token-Endpunkt: Prüfung (PKCE, Redirect, Client) und genau einmal ausgeben. */
export async function tokenFor(input: { code: string; code_verifier: string; redirect_uri: string; client_id: string }) {
  const row = await db.oAuthFlow.findUnique({ where: { codeHash: sha256(input.code) } });
  const result = tokenResult(row, input, row?.clientId ?? "");
  if (result.kind === "error" || !row?.tokenCipher) return { error: result.kind === "error" ? result.error : "invalid_grant" } as const;
  const { count } = await db.oAuthFlow.updateMany({ where: { id: row.id, status: "approved" }, data: { status: "claimed", tokenCipher: null } });
  if (!count) return { error: "invalid_grant" } as const;
  return { access_token: decrypt(row.tokenCipher), token_type: "Bearer", scope: row.scope, expires_in: 0 } as const;
}

