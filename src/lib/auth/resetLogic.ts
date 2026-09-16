// „Passwort vergessen“ ohne Datenbank: Fristen, Grenzen und die maskierte
// Adresse für die Rückmeldung. Sicherheitsfragen gibt es bewusst nicht – die
// sind ratbar; hier zählt nur der Link an die hinterlegte Adresse.

/** Wie lange ein Rücksetz-Link gilt */
export const RESET_TTL_MS = 60 * 60_000;
/** So oft darf je Konto in einer Stunde ein Link angefordert werden */
export const RESET_MAX_PER_HOUR = 3;

export const resetExpiry = (now: Date = new Date()) => new Date(now.getTime() + RESET_TTL_MS);

/** Gültig ist ein Link, der nicht abgelaufen und noch nicht benutzt ist. */
export function resetUsable(row: { expiresAt: Date; usedAt: Date | null } | null, now: Date = new Date()): boolean {
  return Boolean(row && row.usedAt === null && row.expiresAt.getTime() > now.getTime());
}

/** m…n@example.de – zeigt genug zum Wiedererkennen, ohne die Adresse zu verraten. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "…";
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  const short = name.length <= 2 ? `${name[0]}…` : `${name[0]}…${name[name.length - 1]}`;
  return `${short}@${domain}`;
}
