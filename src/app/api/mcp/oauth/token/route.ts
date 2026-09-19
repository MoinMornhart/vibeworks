import { NextResponse, type NextRequest } from "next/server";
import { tokenSchema } from "@/lib/mcp/oauthFlowLogic";
import { tokenFor } from "@/lib/mcp/oauthFlow";

// Token-Endpunkt (RFC 6749 §4.1.3): Das Programm tauscht Autorisierungs-Code
// und PKCE-Verifier gegen seinen API-Schlüssel – genau einmal.
//   POST /api/mcp/oauth/token  grant_type=authorization_code&code=…&code_verifier=…

export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "access_denied" }, { status: 403 });
  try {
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    // Form-Encoded (Standard) oder JSON – beides annehmen
    let body: Record<string, unknown>;
    if (req.headers.get("content-type")?.includes("application/json")) body = JSON.parse(raw || "{}");
    else body = Object.fromEntries(new URLSearchParams(raw));
    const input = tokenSchema.parse(body);
    const res = await tokenFor(input);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "invalid_request", error_description: "grant_type=authorization_code with code, client_id, redirect_uri and code_verifier (43+ chars) is required." }, { status: 400 });
  }
}
