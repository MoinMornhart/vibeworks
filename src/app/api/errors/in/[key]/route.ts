import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/api";
import { config } from "@/lib/config";
import { ingestError } from "@/lib/bugs";
import { MAX_REPORT_BYTES, parseErrorReport } from "@/lib/bugsLogic";
import { hit, MINUTE } from "@/lib/security/rateLimit";

type Params = { key: string };

// Fehler-Eingang: fremde Apps (Browser, Server, Skripte) melden hier Fehler.
// Bewusst ohne Anmeldung, Cookies und Same-Origin-Prüfung – Browser-Apps
// anderer Domains müssen senden dürfen. Der Schlüssel im Pfad ist die einzige
// Berechtigung und erlaubt nur, Fehler in genau dieses Projekt zu schreiben;
// gelesen wird hier nichts. Größen- und Mengenlimits je IP und Projekt, CORS
// ohne Credentials. Nimmt JSON auch als text/plain an (sendBeacon, ohne Preflight).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    if (config.demoMode) return reply(403, { error: "demo" });
    if (!hit(`errors-in-ip:${clientIp(req)}`, 120, 10 * MINUTE).ok) return reply(429, { error: "too many requests" });
    const { key } = await params;
    if (!/^[\w-]{16,64}$/.test(key)) return reply(404, { error: "unknown key" });
    const project = await db.project.findUnique({ where: { errorKey: key }, select: { id: true, name: true, ownerId: true, owner: { select: { active: true } } } });
    if (!project?.owner.active) return reply(404, { error: "unknown key" });
    if (!hit(`errors-in:${project.id}`, 300, 10 * MINUTE).ok) return reply(429, { error: "too many requests" });

    if (Number(req.headers.get("content-length") ?? 0) > MAX_REPORT_BYTES) return reply(413, { error: "too large" });
    const text = await req.text();
    if (text.length > MAX_REPORT_BYTES) return reply(413, { error: "too large" });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return reply(400, { error: "invalid json" });
    }
    const report = parseErrorReport(raw);
    if (!report) return reply(400, { error: "message missing" });
    const result = await ingestError(project, report, req.headers.get("user-agent")?.slice(0, 300) ?? null);
    return reply(202, { ok: true, result });
  } catch (err) {
    console.error("[errors-in]", err);
    return reply(500, { error: "internal error" });
  }
}
