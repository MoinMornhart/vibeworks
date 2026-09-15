import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";

// Letzte MCP-Aufrufe des eigenen Kontos – Werkzeug, Ergebnis, Dauer, Schlüssel; keine Inhalte.
export const GET = route(async () => {
  const user = await requireApiUser();
  const calls = await db.mcpCall.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { token: { select: { name: true } } },
  });
  return json({
    calls: calls.map((c) => ({ id: c.id, tool: c.tool, ok: c.ok, error: c.error, ms: c.ms, token: c.token.name, at: c.createdAt.toISOString() })),
  });
});
