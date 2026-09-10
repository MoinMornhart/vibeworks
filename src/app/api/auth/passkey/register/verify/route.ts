import { Prisma } from "@prisma/client";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { consumeChallenge, defaultPasskeyName, relyingParty, serializePasskey } from "@/lib/auth/webauthn";
import { passkeyRegisterSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const { response, name } = await readBody(req, passkeyRegisterSchema);
  const { rpID, origin } = relyingParty();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: (challenge) => consumeChallenge(challenge, "registration", user.id),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    throw new ApiError(400, `Der Passkey konnte nicht geprüft werden: ${err instanceof Error ? err.message : "unbekannter Fehler"}`);
  }
  if (!verification.verified) throw new ApiError(400, "Der Passkey konnte nicht bestätigt werden.");

  const { credential } = verification.registrationInfo;
  try {
    const passkey = await db.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        name: name || defaultPasskeyName(req.headers.get("user-agent")),
      },
    });
    return json({ passkey: serializePasskey(passkey) }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Dieser Passkey ist bereits registriert.");
    }
    throw err;
  }
});
