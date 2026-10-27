import { z } from "zod";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { readSessionToken, setSessionCookie } from "@/lib/auth/session";
import { adoptAppUrl, originOf } from "@/lib/appUrlLogic";
import { config, setStoredAppUrl } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

// Adresse der Instanz übernehmen – und zwar genau die, über die der Admin gerade
// hier ist (Origin der Anfrage, von route() gegen den Host geprüft). Eingetippt
// wird nichts: So kann sich niemand mit einem Tippfehler oder einem noch nicht
// fertigen Reverse Proxy aussperren. Entspricht sie APP_URL, gilt wieder die .env.

/** Höchstens so viele Wechsel je Admin im Zeitfenster */
const ADOPT_LIMIT = 10;
const ADOPT_WINDOW_MINUTES = 10;
const ADOPT_WINDOW = ADOPT_WINDOW_MINUTES * MINUTE;
const MAX_BODY_BYTES = 256;
const BAD_REQUEST = 400;

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  limitOrThrow(`app-url:${admin.id}`, ADOPT_LIMIT, ADOPT_WINDOW);
  await readBody(req, z.object({ action: z.literal("adopt") }), { maxBytes: MAX_BODY_BYTES });
  const origin = originOf(req.headers.get("origin"));
  if (!origin) throw new ApiError(BAD_REQUEST, tk("admin", "address.errors.noOrigin"));

  // Noch unter dem bisherigen Cookie-Namen lesen – bei http ↔ https heißt er gleich anders
  const token = await readSessionToken();
  const stored = adoptAppUrl(origin, config.envAppUrl);
  await db.settings.upsert({ where: { id: "instance" }, create: { id: "instance", ...stored }, update: stored });
  setStoredAppUrl(stored);

  // Die eigene Sitzung unter dem neuen Cookie-Namen mitnehmen; alle anderen melden sich einmal neu an
  if (token) {
    const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, select: { expiresAt: true } });
    if (session) await setSessionCookie(token, session.expiresAt);
  }
  return json({ appUrl: config.appUrl, fromEnv: stored.appUrl === null });
});
