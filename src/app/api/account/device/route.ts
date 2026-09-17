import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { deviceDecisionSchema } from "@/lib/mcp/deviceAuthLogic";
import { decideDevice, pendingByCode } from "@/lib/mcp/deviceAuth";

// Freigabe einer Geräte-Anmeldung (#104) – nur mit Sitzung, nie mit API-Schlüssel.

export const GET = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`device-check:${user.id}`, 30, 10 * MINUTE);
  const device = await pendingByCode(req.nextUrl.searchParams.get("code") ?? "");
  return json({ device });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`device-decide:${user.id}`, 20, 10 * MINUTE);
  const input = await readBody(req, deviceDecisionSchema, { maxBytes: 512 });
  return json(await decideDevice(user.id, input));
});
