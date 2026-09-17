import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, clientIp } from "@/lib/api";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { deviceTokenSchema } from "@/lib/mcp/deviceAuthLogic";
import { pollDevice } from "@/lib/mcp/deviceAuth";

// Schlüssel abholen (#104): Das Programm fragt mit seinem Geräte-Code nach,
// bis der Mensch entschieden hat. Der Schlüssel kommt genau einmal.
//   POST /api/mcp/device/token  {"device_code": "…"}

export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  try {
    limitOrThrow(`device-poll:${clientIp(req) ?? "?"}`, 120, 10 * MINUTE);
    const raw = await req.text();
    if (raw.length > 1024) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    const { device_code } = deviceTokenSchema.parse(JSON.parse(raw || "{}"));
    const res = await pollDevice(device_code);
    return NextResponse.json(res, { status: "error" in res ? 400 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "invalid_request", error_description: "Send JSON with device_code." }, { status: 400 });
    if (err instanceof ApiError && err.status === 429) return NextResponse.json({ error: "slow_down" }, { status: 429 });
    console.error("[device]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
