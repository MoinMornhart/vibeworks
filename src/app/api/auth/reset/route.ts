import { after } from "next/server";
import { z } from "zod";
import { clientIp, json, readBody, route } from "@/lib/api";
import { requestReset } from "@/lib/auth/passwordReset";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const schema = z.object({ login: z.string().trim().min(1).max(254) });

// Rücksetz-Link anfordern (öffentlich). Die Antwort ist immer dieselbe –
// so verrät die Seite nicht, welche Konten oder Adressen es gibt.
export const POST = route(async (req) => {
  limitOrThrow(`reset-request:${clientIp(req) ?? "?"}`, 5, 15 * MINUTE);
  const { login } = await readBody(req, schema, { maxBytes: 512 });
  const ip = clientIp(req);
  after(() => requestReset(login, ip));
  return json({ ok: true });
});
