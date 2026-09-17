// Beta-Ansicht (#68): Admins sehen kommende Oberflächen, ohne etwas zu ändern.
// Solange sie an ist, lehnt die API schreibende Anfragen ab – bis auf das
// Beenden der Beta-Ansicht, An-/Abmelden und die Sprache. Ohne Datenbank.

export const BETA_COOKIE = "vw-beta";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED = new Set(["/api/admin/beta", "/api/auth/login", "/api/auth/logout", "/api/locale"]);

export function betaAllows(method: string, pathname: string): boolean {
  if (SAFE.has(method.toUpperCase())) return true;
  return ALLOWED.has(pathname.replace(/\/+$/, ""));
}

/**
 * Funktionen, die es vorerst nur in der Beta-Ansicht gibt. Leer heißt: die
 * Beta-Ansicht zeigt den aktuellen Stand, nur schreibgeschützt.
 */
const BETA_FEATURES: readonly string[] = [];
