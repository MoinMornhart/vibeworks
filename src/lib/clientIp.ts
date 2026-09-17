import type { NextRequest } from "next/server";

/** Adresse der Anfrage (hinter dem Proxy aus X-Forwarded-For). Eigene Datei gegen den Import-Zyklus (#73). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? "unbekannt");
  // IPv4 im IPv6-Gewand (::ffff:192.168.1.5) lesbar machen
  return ip.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
}
