import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { clientIp, json, route } from "@/lib/api";
import { relyingParty, storeChallenge } from "@/lib/auth/webauthn";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Anmeldung mit auffindbaren Passkeys: keine Liste erlaubter Credentials,
// der Authenticator schlägt selbst vor, welche er für diese Seite hat.
export const POST = route(async (req) => {
  limitOrThrow(`passkey-opt:${clientIp(req)}`, 30, 15 * MINUTE);
  const options = await generateAuthenticationOptions({ rpID: relyingParty().rpID, userVerification: "preferred" });
  await storeChallenge(options.challenge, "authentication", null);
  return json({ options });
});
