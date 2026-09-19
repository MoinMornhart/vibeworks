import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { oauthMetadata, protectedResourceMetadata } from "@/lib/mcp/oauthFlowLogic";

// OAuth-Server-Metadaten (RFC 8414 + RFC 9728), auch unterhalb von
// /.well-known/<name>/<ressource>: RFC 8414 Abschnitt 3.1 verlangt, dass der
// Autorisierungsserver-Metadaten-Pfad den Endpunkt-Pfad enthaelt – ChatGPT
// fragt also /.well-known/oauth-authorization-server/api/mcp ab. Ohne diese
// Route lehnt es den Connector ab ("does not implement OAuth").

const json = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });

function handle(name: string) {
  if (name === "oauth-authorization-server") return json(oauthMetadata(config.appUrl));
  if (name === "oauth-protected-resource") return json(protectedResourceMetadata(config.appUrl));
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

// /.well-known/<name> und /.well-known/<name>/<ressource> – beides ausliefern.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(path[0] ?? "");
}
