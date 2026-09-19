import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { deviceDecisionSchema, oauthDecisionSchema } from "@/lib/mcp/deviceAuthLogic";
import { decideDevice, pendingByCode } from "@/lib/mcp/deviceAuth";
import { decideOAuth, pendingByOAuthCode } from "@/lib/mcp/oauthFlow";

// Freigabe einer Geräte-Anmeldung (#104) oder OAuth-Autorisierung (#141) –
// nur mit Sitzung, nie mit API-Schlüssel.

export const GET = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`device-check:${user.id}`, 30, 10 * MINUTE);
  const code = req.nextUrl.searchParams.get("code") ?? "";
  // OAuth-Codes sind länger – erst die Geräte-Suche, dann die OAuth-Suche
  const device = await pendingByCode(code);
  const oauth = device ? null : await pendingByOAuthCode(code);
  return json({ device, oauth });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`device-decide:${user.id}`, 20, 10 * MINUTE);
  const input = await readBody(req, oauthDecisionSchema.or(deviceDecisionSchema), { maxBytes: 512 });
  // Am Code-Format unterscheiden: Geräte-Codes sind kurz (8 Zeichen), OAuth-Codes lang
  if (input.code.length > 20) {
    return json(await decideOAuth(user.id, oauthDecisionSchema.parse(input)));
  }
  return json(await decideDevice(user.id, deviceDecisionSchema.parse(input)));
});
