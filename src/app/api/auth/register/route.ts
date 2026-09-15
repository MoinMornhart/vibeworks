import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { getSettings, registrationOpen } from "@/lib/settings";
import { consumeInvite } from "@/lib/invites";
import { sha256 } from "@/lib/crypto";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { optionalCredential } from "@/lib/git/token";
import { tk } from "@/lib/i18n/messages";

// Selbstregistrierung – nur im Mehrbenutzerbetrieb: entweder freigeschaltet
// oder mit einem gültigen Einladungslink (einmal nutzbar, läuft ab).
export const POST = route(async (req) => {
  limitOrThrow(`register:${clientIp(req)}`, 5, 60 * MINUTE);
  const input = await readBody(req, registerSchema);
  if (input.invite) {
    if ((await getSettings()).mode !== "MULTI") throw new ApiError(403, tk("auth", "errors.inviteInvalid"));
  } else if (!(await registrationOpen())) {
    throw new ApiError(403, tk("auth", "errors.registrationClosed"));
  }

  const policy = checkPasswordPolicy(input.password, input.username);
  if (policy) throw new ApiError(400, policy, { password: policy });
  const tokenData = await optionalCredential(input);
  const passwordHash = await hashPassword(input.password);

  try {
    // Einladung verbrauchen und Konto anlegen in einem Schritt: ist der Name
    // vergeben, bleibt die Einladung gültig; zweimal einlösen geht nicht.
    const user = await db.$transaction(async (tx) => {
      if (input.invite && !(await consumeInvite(tx, input.invite))) throw new ApiError(403, tk("auth", "errors.inviteInvalid"));
      const created = await tx.user.create({
        data: { username: input.username, displayName: input.displayName, passwordHash, passwordChangedAt: new Date(), role: "USER", ...tokenData },
      });
      if (input.invite) await tx.invite.updateMany({ where: { tokenHash: sha256(input.invite) }, data: { usedById: created.id } });
      return created;
    });
    await startSession(user.id, req);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, tk("auth", "errors.usernameTaken"), { username: tk("auth", "errors.taken") });
    }
    throw err;
  }
  return json({ ok: true });
});
