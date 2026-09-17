import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, clientIp } from "@/lib/api";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { deviceStartSchema } from "@/lib/mcp/deviceAuthLogic";
import { startDevice } from "@/lib/mcp/deviceAuth";

// Geräte-Anmeldung starten (#104) – öffentlich, damit ein KI-Programm sich
// selbst einen Code holen kann. Zugang gibt es erst nach der Freigabe durch
// ein angemeldetes Konto (/verbinden). Antworten wie RFC 8628, auf Englisch.
//   POST /api/mcp/device  {"client_name": "Julia", "scope": "tasks"}

export async function POST(req: NextRequest) {
  // Aus Webseiten heraus nicht – nur Programme (wie beim MCP-Endpunkt)
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const ip = clientIp(req);
  try {
    limitOrThrow(`device-start:${ip ?? "?"}`, 10, 10 * MINUTE);
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    const input = deviceStartSchema.parse(raw ? JSON.parse(raw) : {});
    return NextResponse.json(await startDevice({ clientName: input.client_name, scope: input.scope, ip }), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_request", error_description: "Send JSON with client_name (1–60 characters) and optionally scope: read, tasks or all." }, { status: 400 });
    }
    if (err instanceof ApiError) return NextResponse.json({ error: err.status === 429 ? "slow_down" : "invalid_request", error_description: err.message }, { status: err.status });
    console.error("[device]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
