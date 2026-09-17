import { z } from "zod";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { tk } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";
import { guildChannels, removeLink, reportMessage, sendToChannel } from "@/lib/discord/discord";
import { REPORT_MODES } from "@/lib/discord/discordLogic";
import { serializeDiscordLink } from "@/lib/discord/view";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Eine Discord-Verbindung (#105): Kanäle, Einstellungen, Bericht senden, trennen – nur die eigene.

async function own(userId: string, id: string) {
  const link = await db.discordLink.findFirst({ where: { id, userId } });
  if (!link) throw notFound("Discord link not found");
  return link;
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const link = await own(user.id, (await params).id);
  limitOrThrow(`discord-channels:${user.id}`, 30, MINUTE);
  return json({ channels: await guildChannels(link.guildId) });
});

const patchSchema = z.object({
  channelId: z.string().regex(/^\d{5,25}$/).nullable().optional(),
  forward: z.boolean().optional(),
  report: z.enum(REPORT_MODES).optional(),
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const link = await own(user.id, (await params).id);
  const input = await readBody(req, patchSchema, { maxBytes: 512 });
  let channelName: string | null | undefined;
  if (input.channelId) {
    // Nur Kanäle dieses Servers, die der Bot sieht
    const channel = (await guildChannels(link.guildId)).find((c) => c.id === input.channelId);
    if (!channel) throw new ApiError(400, tk("discord", "errors.noChannel"));
    channelName = channel.name;
  } else if (input.channelId === null) channelName = null;
  const updated = await db.discordLink.update({
    where: { id: link.id },
    data: {
      ...(input.channelId !== undefined ? { channelId: input.channelId, channelName } : {}),
      ...(input.forward !== undefined ? { forward: input.forward } : {}),
      ...(input.report !== undefined ? { report: input.report } : {}),
    },
  });
  return json({ link: serializeDiscordLink(updated) });
});

// Bericht jetzt in den Kanal
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const link = await own(user.id, (await params).id);
  limitOrThrow(`discord-report:${user.id}`, 5, 10 * MINUTE);
  if (!link.channelId) throw new ApiError(400, tk("discord", "errors.noChannel"));
  try {
    await sendToChannel(link.channelId, await reportMessage(user.id, link.report === "weekly" ? "week" : "day", await getLocale()));
  } catch (err) {
    const message = err instanceof Error ? err.message : tk("discord", "errors.failed");
    await db.discordLink.update({ where: { id: link.id }, data: { lastError: message.slice(0, 300) } });
    throw new ApiError(502, message);
  }
  const updated = await db.discordLink.update({ where: { id: link.id }, data: { lastError: null } });
  return json({ link: serializeDiscordLink(updated) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  if (!(await removeLink(user.id, (await params).id))) throw notFound("Discord link not found");
  return json({ ok: true });
});
