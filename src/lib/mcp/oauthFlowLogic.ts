import { createHash } from "node:crypto";
import { z } from "zod";
import { KEY_SCOPES } from "./keySettings";

// OAuth 2.0 mit PKCE für KI-Programme (#141): ChatGPT & Co. verlangen einen
// standardmäßigen OAuth-Ablauf am MCP-Endpunkt (Metadaten, dynamische
// Client-Registrierung, Autorisierungs-Code mit S256-Challenge). Die Freigabe
// selbst bleibt beim Menschen – sie läuft über die bewährte Seite /verbinden,
// genau wie bei der Geräte-Anmeldung (#104). Ohne Client-Geheimnis: public
// client mit PKCE, wie von OpenAI vorgegeben.

export const OAUTH_TTL_MS = 10 * 60_000;

/** OAuth-Server-Metadaten (RFC 8414) – ChatGPT prüft daraus PKCE (S256). */
export function oauthMetadata(appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  return {
    issuer: base,
    // Beide Orte prüfen Clients unterschiedlich streng – beide stehen im Spec-Beispiel
    authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: KEY_SCOPES,
  };
}

/** Geschützte Metadaten (RFC 9728) – manche Clients suchen dort die Autorisierung. */
export function protectedResourceMetadata(appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  return {
    resource: base,
    authorization_servers: [base],
    scopes_supported: KEY_SCOPES,
  };
}

/** Dynamische Client-Registrierung (RFC 7591): nur, was VibeWorks braucht. */
export const clientRegisterSchema = z.object({
  client_name: z.string().trim().min(1).max(60),
  redirect_uris: z.array(z.string().max(500)).min(1).max(5),
});

/**redirect-Adressen: nur https (bzw. http auf localhost für Entwicklung). */
export function validRedirectUris(uris: string[]): boolean {
  return uris.every((uri) => {
    try {
      const u = new URL(uri);
      return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
    } catch {
      return false;
    }
  });
}

/** Kurzlebige Client-Kennung – merkt sich VibeWorks nur für den Ablauf. */
export function newClientId(): string {
  return `app_${randomId(18)}`;
}

/** Autorisierungs-Code: nur das Programm kennt ihn, VibeWorks speichert den Hash. */
export function newAuthorizationCode(): string {
  return randomId(32);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomId(n: number): string {
  let s = "";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < n; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

/** PKCE: base64url(SHA-256(verifier)) – exakt wie RFC 7636, S256. */
export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export const authorizeSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(80),
  redirect_uri: z.string().max(500),
  scope: z.enum(KEY_SCOPES).default("tasks"),
  state: z.string().max(200).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256").default("S256"),
});

export const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(10).max(128),
  client_id: z.string().min(1).max(80),
  redirect_uri: z.string().max(500),
  code_verifier: z.string().min(43).max(128),
});

/** Fehlerantworten am Token-Endpunkt (RFC 6749 §5.2). */
export type TokenError = "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type" | "expired_token" | "access_denied" | "slow_down";

export type TokenResult = { kind: "error"; error: TokenError } | { kind: "token" };

/** Nachfrage am Token-Endpunkt: Prüfung von Status und PKCE vor der Ausgabe. */
export function tokenResult(row: { status: string; codeChallenge: string; expiresAt: Date; redirectUri: string } | null, input: { code_verifier: string; redirect_uri: string; client_id: string }, clientId: string, now = Date.now()): TokenResult {
  if (!row || row.status === "claimed") return { kind: "error", error: "invalid_grant" };
  if (row.expiresAt.getTime() <= now) return { kind: "error", error: "expired_token" };
  if (row.status === "denied") return { kind: "error", error: "access_denied" };
  if (row.status === "pending") return { kind: "error", error: "slow_down" };
  // Redirect und Client müssen exakt zum Autorisierungs-Start passen
  if (row.redirectUri !== input.redirect_uri || clientId !== input.client_id) return { kind: "error", error: "invalid_grant" };
  // PKCE: der Verifier muss zur gemerkten Challenge passen
  if (s256Challenge(input.code_verifier) !== row.codeChallenge) return { kind: "error", error: "invalid_grant" };
  return { kind: "token" };
}

/** Die Freigabe-Seite erhält den Autorisierungs-Start als einfachen Auftrag. */
export function authorizeView(input: z.infer<typeof authorizeSchema>) {
  return { clientId: input.client_id, redirectUri: input.redirect_uri, scope: input.scope, codeChallenge: input.code_challenge, state: input.state ?? null };
}

/** Rückkehr-Adresse für den Browser des Menschen: Programm-Seite plus Code und state. */
export function oauthReturnUrl(redirectUri: string, code: string | null, state: string | null): string {
  const url = new URL(redirectUri);
  // Bei Ablehnung statt des Codes der Standard-Fehler (RFC 6749 §4.1.2.1)
  if (code) url.searchParams.set("code", code);
  else url.searchParams.set("error", "access_denied");
  if (state) url.searchParams.set("state", state);
  return url.toString();
}
