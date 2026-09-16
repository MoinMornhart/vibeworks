import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { config } from "@/lib/config";
import { installPs1, installSh } from "@/lib/mcp/installer";
import { hit, MINUTE } from "@/lib/security/rateLimit";

type Params = { kind: string };

// Einrichtungsskript für den MCP-Einzeiler (#89) – öffentlich, enthält nur die
// Adresse dieser Instanz. Der Schlüssel kommt beim Aufruf aus VIBEWORKS_KEY.
export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  if (!hit(`mcp-install:${clientIp(req)}`, 30, 10 * MINUTE).ok) return new NextResponse("Too many requests\n", { status: 429 });
  const { kind } = await params;
  const body = kind === "sh" ? installSh(config.appUrl) : kind === "ps1" ? installPs1(config.appUrl) : null;
  if (!body) return new NextResponse("Unknown installer – use sh or ps1\n", { status: 404 });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
