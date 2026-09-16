import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { startBotApp } from "@/lib/git/botApp";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

/**
 * Bot per Klick starten: liefert Ziel und App-Beschreibung für das Formular,
 * das der Browser an GitHub schickt. Die App darf nur Issues schreiben.
 */
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-bot:${user.id}`, 10, 10 * MINUTE);
  return json(await startBotApp(user.id, (await params).id));
});
