import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { config } from "@/lib/config";
import { finishInstall } from "@/lib/discord/discord";
import { readState } from "@/lib/discord/discordLogic";

/**
 * Rücksprung von Discord (#105): State prüfen (gleiches Konto, nicht
 * abgelaufen), Code tauschen, Server merken – dann zurück ins Konto.
 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const q = req.nextUrl.searchParams;
  const back = (params: Record<string, string>) => NextResponse.redirect(`${config.appUrl}/account?${new URLSearchParams(params).toString()}#discord`, 303);
  if (q.get("error")) return back({ discord: "denied" });
  if (readState(config.secret, q.get("state")) !== user.id) return back({ discord: "state" });
  const code = q.get("code");
  const guildId = q.get("guild_id");
  if (!code || !guildId || !/^\d{5,25}$/.test(guildId)) return back({ discord: "install" });
  try {
    const link = await finishInstall(user.id, code, guildId);
    return back({ discord: "ok", guild: link.guildName ?? guildId });
  } catch (err) {
    console.warn("[discord] Rücksprung:", err instanceof Error ? err.message : err);
    return back({ discord: "install" });
  }
});
