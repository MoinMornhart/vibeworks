import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { discordConfig } from "@/lib/discord/discord";
import { serializeDiscordLink } from "@/lib/discord/view";

// Discord-Verbindungen des eigenen Kontos (#105).
export const GET = route(async () => {
  const user = await requireApiUser();
  const [cfg, links] = await Promise.all([discordConfig(), db.discordLink.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })]);
  return json({ ready: cfg.ready, links: links.map(serializeDiscordLink) });
});
