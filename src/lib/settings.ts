import { cache } from "react";
import { db } from "./db";
import { config, setStoredAppUrl } from "./config";

// Die eine Einstellungszeile wird auf jeder Seite mehrfach gebraucht (Layout,
// Anmeldung, Projektseite …). `cache` holt sie deshalb nur einmal je Anfrage –
// vorher waren es zwei bis drei Abfragen pro Seitenaufruf (#214).
export const getSettings = cache(async () => {
  const existing = await db.settings.findUnique({ where: { id: "instance" } });
  // Die übernommene Adresse gleich mit auffrischen (siehe appUrlLogic.ts)
  if (existing) {
    setStoredAppUrl(existing);
    return existing;
  }
  return db.settings.upsert({ where: { id: "instance" }, create: { id: "instance" }, update: {} });
});

/**
 * Beim Start: übernommene Adresse laden, bevor die erste Anfrage sie braucht.
 * Wurde APP_URL in der .env inzwischen geändert, gilt die .env – und die
 * übernommene Adresse wird gelöscht, damit sie später nicht wieder auflebt.
 */
export async function loadStoredAppUrl(): Promise<void> {
  try {
    const stored = await db.settings.findUnique({ where: { id: "instance" }, select: { appUrl: true, appUrlEnv: true } });
    if (stored?.appUrl && stored.appUrlEnv !== config.envAppUrl) {
      await db.settings.update({ where: { id: "instance" }, data: { appUrl: null, appUrlEnv: null } });
      console.info(`[vibeworks] APP_URL in der .env geändert – sie gilt wieder (${config.envAppUrl}), ${stored.appUrl} ist vergessen.`);
      setStoredAppUrl(null);
      return;
    }
    setStoredAppUrl(stored);
  } catch (err) {
    console.warn("[vibeworks] Adresse aus den Einstellungen nicht lesbar – APP_URL gilt:", err instanceof Error ? err.message : err);
  }
}

export async function isSetupDone(): Promise<boolean> {
  return Boolean((await getSettings()).setupDoneAt);
}

export async function registrationOpen(): Promise<boolean> {
  const s = await getSettings();
  return s.mode === "MULTI" && s.allowRegistration;
}
