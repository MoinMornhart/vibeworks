import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { describeUserAgent } from "@/lib/userAgent";

// Passkeys (WebAuthn). Die Relying-Party-ID ist der Hostname aus APP_URL –
// Passkeys sind daran gebunden. Wer den Hostnamen später ändert, muss sie
// neu anlegen; Passwörter funktionieren weiter.

export function relyingParty() {
  const url = new URL(config.appUrl);
  return { rpID: url.hostname, origin: url.origin, rpName: config.appName };
}

export type ChallengePurpose = "registration" | "authentication";
const CHALLENGE_MINUTES = 5;

export async function storeChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null) {
  await db.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.webAuthnChallenge.create({
    data: { challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) },
  });
}

/** Löst eine Challenge genau einmal ein – danach ist sie weg, egal wie die Prüfung ausgeht. */
export async function consumeChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null): Promise<boolean> {
  const { count } = await db.webAuthnChallenge.deleteMany({
    where: { challenge, purpose, userId, expiresAt: { gt: new Date() } },
  });
  return count === 1;
}

export function toCredential(p: { credentialId: string; publicKey: Uint8Array; counter: number; transports: string[] }): WebAuthnCredential {
  return {
    id: p.credentialId,
    publicKey: new Uint8Array(p.publicKey),
    counter: p.counter,
    transports: p.transports as AuthenticatorTransportFuture[],
  };
}

/** Vorschlag für einen Namen, falls keiner angegeben wurde: „Edge auf Windows“. */
export function defaultPasskeyName(userAgent: string | null): string {
  const d = describeUserAgent(userAgent);
  return d.os ? `${d.browser} auf ${d.os}` : "Passkey";
}

export function serializePasskey(p: { id: string; name: string | null; createdAt: Date; lastUsedAt: Date | null; transports: string[] }) {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    transports: p.transports,
  };
}
export type PasskeyItem = ReturnType<typeof serializePasskey>;
