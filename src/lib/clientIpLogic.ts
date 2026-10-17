// Echte Client-Adresse aus X-Forwarded-For bestimmen (#214-Sicherheitsrunde).
// Reine Logik ohne Request, damit sie prüfbar ist.
//
// X-Forwarded-For wächst von links nach rechts: ganz links steht, was der
// Client selbst behauptet (frei fälschbar), rechts hängt jeder Proxy die
// Adresse an, die er wirklich gesehen hat. Bei `hops` vertrauenswürdigen
// Proxys ist die echte Adresse der `hops`-letzte Eintrag; was weiter links
// steht, kann der Client gesetzt haben und wird ignoriert.

/** IPv4 im IPv6-Gewand (::ffff:192.168.1.5) wieder lesbar machen. */
function unwrap(ip: string): string {
  // Trifft "::ffff:192.168.1.5" → "192.168.1.5", nicht "2606:4700::1111".
  // https://regex101.com/?regex=%5E%3A%3Affff%3A%28%5Cd%2B%5C.%5Cd%2B%5C.%5Cd%2B%5C.%5Cd%2B%29%24
  return ip.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
}

/**
 * Adresse aus den Headern ableiten. `hops` ist die Zahl vertrauenswürdiger
 * Proxys: 0 heißt, X-Forwarded-For gar nicht zu vertrauen (dann zählt nur
 * X-Real-IP, das der eigene Proxy setzt).
 */
export function pickClientIp(forwardedFor: string | null, realIp: string | null, hops: number): string {
  if (hops > 0 && forwardedFor) {
    const parts = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      // Der hops-letzte Eintrag; bei zu kurzer Liste der linkeste echte.
      const ip = parts[Math.max(0, parts.length - hops)];
      return unwrap(ip);
    }
  }
  return unwrap(realIp ?? "unbekannt");
}
