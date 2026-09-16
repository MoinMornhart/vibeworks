import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { config } from "@/lib/config";
import { finishBotApp } from "@/lib/git/botApp";

/**
 * Rücksprung von GitHub nach „Bot per Klick“: App übernehmen und gleich zur
 * Installation weiterleiten – dort wählt man die Repositories aus. Danach
 * schickt GitHub zurück zu den Git-Zugängen.
 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const q = req.nextUrl.searchParams;
  try {
    return NextResponse.redirect(await finishBotApp(user.id, q.get("code"), q.get("state")), 303);
  } catch (err) {
    console.warn("[bot-app] Rücksprung:", err instanceof Error ? err.message : err);
    const reason = err instanceof ApiError && err.status === 400 ? "expired" : "failed";
    return NextResponse.redirect(`${config.appUrl}/account?bot=${reason}#git-zugang`, 303);
  }
});
