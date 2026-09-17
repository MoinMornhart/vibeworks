import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { config } from "@/lib/config";
import { discordConfig } from "@/lib/discord/discord";
import { installUrl, makeState } from "@/lib/discord/discordLogic";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// „Discord-Server verbinden“ (#105): weiter zu Discord – Server wählen, Rechte bestätigen.
export const GET = route(async () => {
  const user = await requireApiUser();
  limitOrThrow(`discord-install:${user.id}`, 20, 10 * MINUTE);
  const cfg = await discordConfig();
  if (!cfg.ready || !cfg.appId) return NextResponse.redirect(`${config.appUrl}/account?discord=notReady#discord`, 303);
  return NextResponse.redirect(installUrl(cfg.appId, config.appUrl, makeState(config.secret, user.id)), 303);
});
