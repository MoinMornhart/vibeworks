import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, assertSameOrigin } from "@/lib/api";
import { authenticateApiToken } from "@/lib/mcp/token";
import { handleBody, RPC, rpcError } from "@/lib/mcp/protocol";
import { MCP_INSTRUCTIONS, MCP_TOOLS, type McpContext } from "@/lib/mcp/tools";
import { CHANGELOG } from "@/lib/changelog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// MCP-Endpunkt für Claude Code: „Streamable HTTP“, zustandslos, Anmeldung
// per API-Schlüssel (Mein Konto → Claude Code & API-Schlüssel).
//   claude mcp add --transport http vibeworks <APP_URL>/api/mcp --header "Authorization: Bearer vw_…"

const MAX_BODY = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Schutz vor DNS-Rebinding: Aufrufe aus fremden Webseiten abweisen
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, "Forbidden origin"), { status: 403 });
  }

  const auth = await authenticateApiToken(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { error: translateMessage("en", tk("mcp", "errors.unauthorized")) },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="VibeWorks"' } },
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

  const ctx: McpContext = { userId: auth.user.id };
  const { status, body } = await handleBody(raw, ctx, {
    info: { name: "vibeworks", title: "VibeWorks", version: CHANGELOG[0]?.version ?? "0.0.0" },
    instructions: MCP_INSTRUCTIONS,
    tools: MCP_TOOLS,
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
