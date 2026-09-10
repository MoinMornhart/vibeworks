import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { consumeChallenge, relyingParty, toCredential } from "@/lib/auth/webauthn";
import { startSession } from "@/lib/auth/session";
import { passkeyLoginSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Ein Passkey ist an ein Gerät gebunden und damit selbst der zweite Faktor –
// deshalb folgt hier kein TOTP-Schritt.
export const POST = route(async (req) => {
  limitOrThrow(`passkey-login:${clientIp(req)}`, 30, 15 * MINUTE);
  const { response } = await readBody(req, passkeyLoginSchema);
  const { rpID, origin } = relyingParty();

  const passkey = await db.passkey.findUnique({ where: { credentialId: response.id }, include: { user: true } });
  if (!passkey) throw new ApiError(401, "Dieser Passkey ist hier nicht bekannt.");

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as unknown as AuthenticationResponseJSON,
      expectedChallenge: (challenge) => consumeChallenge(challenge, "authentication", null),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: toCredential(passkey),
      requireUserVerification: false,
    });
  } catch {
    throw new ApiError(401, "Die Anmeldung mit dem Passkey ist fehlgeschlagen.");
  }
  if (!verification.verified) throw new ApiError(401, "Die Anmeldung mit dem Passkey ist fehlgeschlagen.");

  const { user } = passkey;
  if (!user.active) throw new ApiError(403, "Dieses Konto ist deaktiviert.");
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw new ApiError(423, "Das Konto ist vorübergehend gesperrt.");

  // Signaturzähler fortschreiben – ein geklonter Schlüssel fiele dadurch auf.
  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  await startSession(user.id, req);
  return json({ ok: true });
});
