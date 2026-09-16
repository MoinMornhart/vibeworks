import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, assertSameOrigin, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { checkApiToken } from "@/lib/mcp/token";
import { handleBody, RPC, rpcError } from "@/lib/mcp/protocol";
import { MCP_INSTRUCTIONS, MCP_PROMPTS, MCP_RESOURCES, type McpContext } from "@/lib/mcp/tools";
import { allMcpTools } from "@/lib/mcp/agentTools";
import { CONFIRM_TOOL, RULES_REMINDER, RULES_TOOL } from "@/lib/mcp/agentRules";
import { CHANGELOG } from "@/lib/changelog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { taskIdOfCall } from "@/lib/taskInfoLogic";

// MCP-Endpunkt für Claude Code: „Streamable HTTP“, zustandslos, Anmeldung
// per API-Schlüssel (Mein Konto → Claude Code & API-Schlüssel).
//   claude mcp add --transport http vibeworks <APP_URL>/api/mcp --header "Authorization: Bearer vw_…"
// Jeder Werkzeugaufruf landet ohne Inhalte im Protokoll des Kontos (30 Tage).

const MAX_BODY = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Schutz vor DNS-Rebinding: Aufrufe aus fremden Webseiten abweisen
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, "Forbidden origin"), { status: 403 });
  }

  const checked = await checkApiToken(req.headers.get("authorization"), { ip: clientIp(req), userAgent: req.headers.get("user-agent") });
  const auth = checked.auth;
  if (!auth) {
    // Klare Ursache statt eines Sammelfehlers (#25): fehlt, kaputt, unbekannt/widerrufen oder Konto gesperrt
    const code = checked.problem ?? "invalid_or_revoked";
    return NextResponse.json(
      { error: translateMessage("en", tk("mcp", `errors.token.${code}`)), code },
      { status: 401, headers: { "WWW-Authenticate": `Bearer realm="VibeWorks", error="invalid_token", error_description="${code}"` } },
    );
  }
  const locale: Locale = isLocale(auth.user.locale) ? auth.user.locale : "de";
  const tr = (text: string) => translateMessage(locale, text);

  try {
    limitOrThrow(`mcp:${auth.tokenId}`, 600, MINUTE);
  } catch (err) {
    return NextResponse.json(rpcError(null, RPC.INTERNAL, err instanceof ApiError ? tr(err.message) : "Too many requests"), { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, "Request too large"), { status: 413 });

  const ctx: McpContext = { userId: auth.user.id, locale, tokenId: auth.tokenId };
  let rulesAcked = Boolean(auth.rulesAckAt);
  const { status, body } = await handleBody(raw, ctx, {
    info: { name: "vibeworks", title: "VibeWorks", version: CHANGELOG[0]?.version ?? "0.0.0" },
    instructions: MCP_INSTRUCTIONS,
    tools: allMcpTools(),
    prompts: MCP_PROMPTS,
    resources: MCP_RESOURCES,
    onInitialize: async (client) => {
      await db.apiToken.update({ where: { id: auth.tokenId }, data: { clientName: client.name, clientVersion: client.version, clientProtocol: client.protocol } });
    },
    outdatedNote: (v) =>
      `Note for the user: this MCP client asked for protocol version ${v}, which VibeWorks no longer supports natively. It still works, but please update the client.`,
    onToolCall: async (call) => {
      if (call.ok && call.tool === CONFIRM_TOOL) rulesAcked = true;
      await db.mcpCall.create({ data: { tokenId: auth.tokenId, userId: auth.user.id, tool: call.tool, ok: call.ok, error: call.error, ms: call.ms, taskId: taskIdOfCall(call.args, call.result) } });
    },
    notice: (tool) => (rulesAcked || tool === RULES_TOOL || tool === CONFIRM_TOOL ? null : RULES_REMINDER),
    describeError: async (err) => {
      if (err instanceof ZodError) return err.issues.map((i) => `${i.path.join(".") || "input"}: ${tr(i.message)}`).join("\n");
      if (err instanceof ApiError) {
        const fields = err.fieldErrors ? Object.entries(err.fieldErrors).map(([k, v]) => `\n${k}: ${tr(v)}`).join("") : "";
        return tr(err.message) + fields;
      }
      console.error("[mcp]", err);
      return "Internal error";
    },
  });
  return status === 202 ? new NextResponse(null, { status: 202 }) : NextResponse.json(body, { status });
}

// Kein Server-Sent-Events-Kanal und keine Sitzungen – laut Spezifikation 405.
const notAllowed = () => new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
