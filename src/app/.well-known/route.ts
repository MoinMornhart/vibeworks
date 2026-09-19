import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { oauthMetadata, protectedResourceMetadata } from "@/lib/mcp/oauthFlowLogic";

// OAuth-Server-Metadaten (RFC 8414 + RFC 9728): ChatGPT & Co. prüfen daraus,
// dass dieser MCP-Server PKCE mit S256 beherrscht – ohne diese Angaben lehnt
// ChatGPT den Connector ab („must advertise PKCE support“). Ausgeliefert wird
// unter /.well-known/oauth-authorization-server und …/oauth-protected-resource
// – der Rest des Pfads landet hier und bekommt beides, je nach Anfrage.

const json = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });

export async function GET() {
  // Beide Dokumente an jedem Well-Known-Ort ausliefern – Clients suchen
  // unterschiedlich: der Autorisierungsserver unter oauth-authorization-server,
  // die Ressource unter oauth-protected-resource. Beide sind harmlos lesbar.
  const meta = oauthMetadata(config.appUrl);
  const res = protectedResourceMetadata(config.appUrl);
  return json({ ...meta, ...res });
}
