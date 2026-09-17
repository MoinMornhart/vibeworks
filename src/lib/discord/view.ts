import type { DiscordLink } from "@/generated/prisma/client";

// Was die Oberfläche von einer Discord-Verbindung sieht (#105).
export function serializeDiscordLink(l: DiscordLink) {
  return {
    id: l.id,
    guildId: l.guildId,
    guildName: l.guildName,
    discordName: l.discordName,
    channelId: l.channelId,
    channelName: l.channelName,
    forward: l.forward,
    report: l.report,
    lastError: l.lastError,
    createdAt: l.createdAt.toISOString(),
  };
}
export type DiscordLinkView = ReturnType<typeof serializeDiscordLink>;
