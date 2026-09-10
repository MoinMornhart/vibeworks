import { generateRegistrationOptions, type AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { relyingParty, storeChallenge } from "@/lib/auth/webauthn";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Neuen Passkey für das angemeldete Konto vorbereiten. Auffindbare
// Credentials (residentKey: required) – so klappt die Anmeldung später
// ohne Benutzernamen.
export const POST = route(async () => {
  const user = await requireApiUser();
  limitOrThrow(`passkey-reg:${user.id}`, 20, 15 * MINUTE);
  const existing = await db.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });
  const { rpID, rpName } = relyingParty();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: displayNameOf(user),
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransportFuture[] })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await storeChallenge(options.challenge, "registration", user.id);
  return json({ options });
});
