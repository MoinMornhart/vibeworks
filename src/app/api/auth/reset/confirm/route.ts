import { z } from "zod";
import { ApiError, clientIp, json, readBody, route } from "@/lib/api";
import { checkPasswordPolicy } from "@/lib/auth/password";
import { completeReset, resetAllowed, resetTarget } from "@/lib/auth/passwordReset";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const schema = z.object({ token: z.string().trim().min(10).max(200), password: z.string().min(1).max(256) });

// Neues Passwort mit dem Link aus der E-Mail setzen (öffentlich, einmal nutzbar).
export const POST = route(async (req) => {
  limitOrThrow(`reset-confirm:${clientIp(req) ?? "?"}`, 10, 15 * MINUTE);
  const { token, password } = await readBody(req, schema, { maxBytes: 1024 });
  if (!(await resetAllowed())) throw new ApiError(400, tk("auth", "reset.off"));
  const target = await resetTarget(token);
  if (!target) throw new ApiError(400, tk("auth", "reset.invalid"), { token: tk("auth", "reset.invalid") });
  const policy = checkPasswordPolicy(password, target.user.username);
  if (policy) throw new ApiError(400, policy, { password: policy });
  await completeReset(target.id, target.user.id, password);
  return json({ ok: true });
});
