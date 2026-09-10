import { db } from "@/lib/db";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { setupSchema } from "@/lib/validation";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Legt beim allerersten Aufruf das Administratorkonto an. Danach gesperrt.
export const POST = route(async (req) => {
  limitOrThrow(`setup:${clientIp(req)}`, 10, 15 * MINUTE);
  const input = await readBody(req, setupSchema);

  const policy = checkPasswordPolicy(input.password, input.username);
  if (policy) throw new ApiError(400, policy, { password: policy });
  const passwordHash = await hashPassword(input.password);

  // Serializable: zwei gleichzeitige Einrichtungen dürfen nicht beide durchkommen.
  const user = await db.$transaction(
    async (tx) => {
      if ((await tx.user.count()) > 0) throw new ApiError(409, "Die Einrichtung ist bereits abgeschlossen.");
      const created = await tx.user.create({
        data: { username: input.username, displayName: input.displayName, passwordHash, role: "ADMIN" },
      });
      const data = {
        mode: input.mode,
        allowRegistration: input.mode === "MULTI" && input.allowRegistration,
        setupDoneAt: new Date(),
      };
      await tx.settings.upsert({ where: { id: "instance" }, create: { id: "instance", ...data }, update: data });
      return created;
    },
    { isolationLevel: "Serializable" },
  );

  await startSession(user.id, req);
  return json({ ok: true });
});
