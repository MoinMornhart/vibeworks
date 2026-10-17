import type { NextRequest } from "next/server";
import { config } from "./config";
import { pickClientIp } from "./clientIpLogic";

/** Adresse der Anfrage (hinter dem Proxy aus X-Forwarded-For). Eigene Datei gegen den Import-Zyklus (#73). */
export function clientIp(req: NextRequest): string {
  return pickClientIp(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"), config.trustedProxyHops);
}
