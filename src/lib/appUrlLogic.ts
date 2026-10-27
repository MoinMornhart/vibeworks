// Öffentliche Adresse der Instanz. Grundwert ist APP_URL aus der .env; im
// Admin-Dashboard lässt sich die Adresse übernehmen, über die man gerade
// angemeldet ist (z. B. nach einem Domainwechsel). Gespeichert wird dazu der
// APP_URL-Wert, der beim Übernehmen galt: Ändert jemand später die .env, hat
// sie wieder das letzte Wort – der Rettungsweg, falls die Domain wegfällt.

export interface StoredAppUrl {
  appUrl: string | null;
  appUrlEnv: string | null;
}

/**
 * Nur Schema, Host und Port – http(s), ohne Pfad, Zugangsdaten oder Query.
 * null, wenn der Wert das nicht ist.
 */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  return url.origin;
}

/** Was gilt: die übernommene Adresse, solange die .env seitdem gleich geblieben ist. */
export function effectiveAppUrl(envUrl: string, stored: StoredAppUrl | null | undefined): string {
  if (stored?.appUrl && stored.appUrlEnv === envUrl) return stored.appUrl;
  return envUrl;
}

/** Was beim Übernehmen gespeichert wird – entspricht die Adresse der .env, gilt wieder nur die .env. */
export function adoptAppUrl(origin: string, envUrl: string): StoredAppUrl {
  return origin === originOf(envUrl) ? { appUrl: null, appUrlEnv: null } : { appUrl: origin, appUrlEnv: envUrl };
}
