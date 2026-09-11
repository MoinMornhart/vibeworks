import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { registrationOpen } from "@/lib/settings";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { optionalCredential } from "@/lib/git/token";
import { tk } from "@/lib/i18n/messages";

// Selbstregistrierung – nur im Mehrbenutzerbetrieb und nur, wenn der
// Administrator sie freigeschaltet hat.
export const POST = route(async (req) => {
  limitOrThrow(`register:${clientIp(req)}`, 5, 60 * MINUTE);
  if (!(await registrationOpen())) throw new ApiError(403, tk("auth", "errors.registrationClosed"));

  const input = await readBody(req, registerSchema);
  const policy = checkPasswordPolicy(input.password, input.username);
  if (policy) throw new ApiError(400, policy, { password: policy });
  const tokenData = await optionalCredential(input);

  try {
    const user = await db.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        role: "USER",
        ...tokenData,
      },
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
