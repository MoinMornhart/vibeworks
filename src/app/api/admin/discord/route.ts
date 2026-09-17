import { z } from "zod";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { config } from "@/lib/config";
import { tk } from "@/lib/i18n/messages";
import { getSettings } from "@/lib/settings";
import { DiscordError, discordConfig, registerCommands } from "@/lib/discord/discord";
import { interactionsUrl, redirectUri } from "@/lib/discord/discordLogic";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Discord-Anwendung der Instanz (#105) – nur für Admins. Token und Secret
// verlassen den Server nie wieder; angezeigt wird nur, ob sie gesetzt sind.

async function view() {
  const [s, cfg] = await Promise.all([getSettings(), discordConfig()]);
  return {
    appId: s.discordAppId ?? "",
    publicKey: s.discordPublicKey ?? "",
    hasBotToken: Boolean(s.discordBotTokenCipher),
    hasClientSecret: Boolean(s.discordClientSecretCipher),
    commandsAt: s.discordCommandsAt?.toISOString() ?? null,
    ready: cfg.ready,
    interactionsUrl: interactionsUrl(config.appUrl),
    redirectUri: redirectUri(config.appUrl),
    links: await db.discordLink.count(),
  };
}

const schema = z.object({
  appId: z.string().trim().regex(/^(\d{5,25})?$/),
  publicKey: z.string().trim().max(64),
  botToken: z.string().trim().max(200).optional(),
  clientSecret: z.string().trim().max(200).optional(),
});

export const GET = route(async () => {
  await requireApiAdmin();
  return json({ discord: await view() });
});

export const PUT = route(async (req) => {
  await requireApiAdmin();
  const input = await readBody(req, schema, { maxBytes: 2048 });
  if (input.publicKey && !/^[0-9a-f]{64}$/i.test(input.publicKey)) throw new ApiError(400, tk("discord", "errors.publicKey"));
  await getSettings();
  await db.settings.update({
    where: { id: "instance" },
    data: {
      discordAppId: input.appId || null,
      discordPublicKey: input.publicKey ? input.publicKey.toLowerCase() : null,
      ...(input.botToken ? { discordBotTokenCipher: encrypt(input.botToken) } : {}),
      ...(input.clientSecret ? { discordClientSecretCipher: encrypt(input.clientSecret) } : {}),
    },
  });
  return json({ discord: await view() });
});

// Befehle bei Discord anmelden
export const POST = route(async () => {
  await requireApiAdmin();
  limitOrThrow("discord-register", 10, 10 * MINUTE);
  try {
    const n = await registerCommands();
    return json({ registered: n, discord: await view() });
  } catch (err) {
    throw new ApiError(err instanceof DiscordError && err.status ? 502 : 400, err instanceof Error ? err.message : tk("discord", "errors.failed"));
  }
});

// Einrichtung entfernen – Verbindungen bleiben stehen, bekommen aber nichts mehr
export const DELETE = route(async () => {
  await requireApiAdmin();
  await db.settings.update({
    where: { id: "instance" },
    data: { discordAppId: null, discordPublicKey: null, discordBotTokenCipher: null, discordClientSecretCipher: null, discordCommandsAt: null },
  });
  return json({ discord: await view() });
});
