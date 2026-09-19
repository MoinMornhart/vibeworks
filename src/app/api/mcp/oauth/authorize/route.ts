import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { authorizeSchema } from "@/lib/mcp/oauthFlowLogic";
import { startAuthorization } from "@/lib/mcp/oauthFlow";

// Autorisierung starten: Das Programm schickt den Browser des Menschen hierher
// (GET, wie im OAuth-Standard üblich). VibeWorks legt den Code an und leitet
// auf die Freigabe-Seite /verbinden – dort entscheiden wie bei der
// Geräte-Anmeldung. Nur Fehlfälle antworten direkt mit JSON.

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = authorizeSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", error_description: "response_type=code, client_id, redirect_uri (https), code_challenge (S256) and scope (read|tasks|all) are required." }, { status: 400 });
  }
  const view = parsed.data;
  // Nur https (bzw. localhost) – dieselbe Regel wie bei der Registrierung
  try {
    const u = new URL(view.redirect_uri);
    if (!(u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")))) throw new Error("scheme");
  } catch {
    return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri must be https (or http on localhost)." }, { status: 400 });
  }
  const redirect = await startAuthorization({
    clientId: view.client_id,
    clientName: "OAuth-Programm",
    redirectUri: view.redirect_uri,
    scope: view.scope,
    codeChallenge: view.code_challenge,
    state: view.state ?? null,
    ip: clientIp(req),
  });
  return NextResponse.redirect(redirect, { status: 302, headers: { "Cache-Control": "no-store" } });
}
