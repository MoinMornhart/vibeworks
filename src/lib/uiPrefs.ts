import { cache } from "react";
import { db } from "@/lib/db";
import { hider, readUiPrefs, type UiKey, type UiPrefs } from "@/lib/uiPrefsLogic";

/** Ausgeblendete Bereiche eines Kontos – pro Anfrage nur einmal geladen (#109) */
export const uiPrefsOf = cache(async (userId: string): Promise<UiPrefs> => {
  const row = await db.user.findUnique({ where: { id: userId }, select: { ui: true } });
  return readUiPrefs(row?.ui);
});

/** Prüffunktion „wird dieser Bereich gezeigt?“ für Serverseiten */
export async function viewOf(userId: string): Promise<(key: UiKey) => boolean> {
  return hider(await uiPrefsOf(userId));
}
