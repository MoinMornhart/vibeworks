import { after } from "next/server";
import { z } from "zod";
import { clientIp, json, readBody, route } from "@/lib/api";
import { askAdmins } from "@/lib/auth/passwordReset";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const schema = z.object({ login: z.string().trim().min(1).max(254) });

// „Moini soll mir ein neues Passwort geben“ (#43): die Bitte landet bei allen
// Administratoren. Die Antwort ist immer dieselbe – auch hier wird nicht
// verraten, ob es das Konto gibt.
export const POST = route(async (req) => {
  limitOrThrow(`reset-ask:${clientIp(req) ?? "?"}`, 5, 15 * MINUTE);
  const { login } = await readBody(req, schema, { maxBytes: 512 });
  after(() => askAdmins(login));
  return json({ ok: true });
});
