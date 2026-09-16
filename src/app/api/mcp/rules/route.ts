import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { isLocale } from "@/lib/i18n/config";
import { agentRules } from "@/lib/mcp/agentRules";
import { allMcpTools, rulesVersion } from "@/lib/mcp/agentTools";
import { checkApiToken } from "@/lib/mcp/token";
import { hit, MINUTE } from "@/lib/security/rateLimit";

// Agenten-Regeln als Skill-Datei für den Installer (#89). Nur mit gültigem
// API-Schlüssel; wer sie so holt, speichert sie – das zählt als bestätigt.
export async function GET(req: NextRequest) {
  if (!hit(`mcp-rules:${clientIp(req)}`, 30, 10 * MINUTE).ok) return new NextResponse("Too many requests\n", { status: 429 });
  const checked = await checkApiToken(req.headers.get("authorization"), { ip: clientIp(req), userAgent: req.headers.get("user-agent") });
  if (!checked.auth) {
    return new NextResponse(`Invalid API key (${checked.problem ?? "invalid_or_revoked"})\n`, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="VibeWorks"' } });
  }
  const locale = isLocale(checked.auth.user.locale) && checked.auth.user.locale === "en" ? "en" : "de";
  await db.apiToken.update({ where: { id: checked.auth.tokenId }, data: { rulesAckAt: new Date(), rulesVersion: rulesVersion(locale) } });
  return new NextResponse(agentRules(allMcpTools(), config.appUrl, locale), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
  });
}
