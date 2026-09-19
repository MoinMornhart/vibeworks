import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { clientRegisterSchema, validRedirectUris } from "@/lib/mcp/oauthFlowLogic";
import { registerClient } from "@/lib/mcp/oauthFlow";

// Dynamische Client-Registrierung (RFC 7591): Das Programm meldet sich mit
// Name und Redirect-Adressen an und bekommt eine kurzlebige Client-Kennung.
//   POST /api/mcp/oauth/register  {"client_name": "ChatGPT", "redirect_uris": ["…"]}

export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "access_denied", error_description: "forbidden origin" }, { status: 403 });
  try {
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({ error: "invalid_client_metadata" }, { status: 413 });
    const input = clientRegisterSchema.parse(JSON.parse(raw || "{}"));
    if (!validRedirectUris(input.redirect_uris)) {
      return NextResponse.json({ error: "invalid_redirect_uri", error_description: "Only https (or http on localhost) redirect URIs are allowed." }, { status: 400 });
    }
    return NextResponse.json(await registerClient(input, clientIp(req)), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Send JSON with client_name and redirect_uris." }, { status: 400 });
  }
}
