import { NextResponse, type NextRequest } from "next/server";
import { discordConfig, handleInteraction } from "@/lib/discord/discord";
import { parseInteraction, verifyDiscordSignature } from "@/lib/discord/discordLogic";

// Befehle aus Discord (#105) – öffentlich, weil Discord selbst anfragt.
// Ohne gültige Ed25519-Signatur mit dem Public Key der Instanz geht nichts.

const MAX_BODY = 64 * 1024;

export async function POST(req: NextRequest) {
  const cfg = await discordConfig();
  if (!cfg.publicKey) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const body = await req.text();
  if (body.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyDiscordSignature(cfg.publicKey, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"), body)) {
    return NextResponse.json({ error: "invalid request signature" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const interaction = parseInteraction(raw);
  if (!interaction) return NextResponse.json({ error: "bad interaction" }, { status: 400 });
  try {
    return NextResponse.json(await handleInteraction(interaction));
  } catch (err) {
    console.error("[discord] Befehl:", err);
    return NextResponse.json({ type: 4, data: { content: "VibeWorks: internal error", flags: 64 } });
  }
}
