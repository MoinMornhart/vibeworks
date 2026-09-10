import { lookup } from "node:dns/promises";
import net from "node:net";
import { config } from "@/lib/config";

// Schutz vor Server-Side Request Forgery: Adressen, die der Server abruft,
// stammen vom Benutzer (Repository-Adresse). Vor jedem Abruf werden alle
// aufgelösten IP-Adressen geprüft – auch nach Weiterleitungen. Gesperrt sind
// Loopback, Link-Local samt Cloud-Metadaten (169.254.169.254), CGNAT,
// Multicast; privates LAN nur auf Wunsch (selbst gehostetes Gitea soll gehen).

export class FetchBlockedError extends Error {}

export function isBlockedIp(ip: string, opts: { blockPrivate?: boolean; allowLoopback?: boolean } = {}): boolean {
  const { blockPrivate = false, allowLoopback = false } = opts;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1], opts);

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return !allowLoopback;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // Link-Local, Cloud-Metadaten
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast, reserviert
    if (blockPrivate && (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    if (lower === "::1") return !allowLoopback;
    if (lower === "::") return true;
    if (/^fe[89ab]/.test(lower)) return true; // Link-Local
    if (lower.startsWith("ff")) return true; // Multicast
    if (blockPrivate && /^f[cd]/.test(lower)) return true; // Unique Local
    return false;
  }
  return true;
}

export async function assertFetchable(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchBlockedError("Nur http- und https-Adressen sind erlaubt.");
  if (url.username || url.password) throw new FetchBlockedError("Zugangsdaten gehören nicht in die Adresse.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    if (!config.gitAllowLoopback) throw new FetchBlockedError("Adressen auf diesem Rechner sind gesperrt (GIT_ALLOW_LOOPBACK).");
    return;
  }
  const addresses = net.isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new FetchBlockedError(`Der Name ${host} lässt sich nicht auflösen.`);
  for (const ip of addresses) {
    if (isBlockedIp(ip, { blockPrivate: config.gitBlockPrivate, allowLoopback: config.gitAllowLoopback })) {
      throw new FetchBlockedError(`Die Adresse ${host} (${ip}) ist aus Sicherheitsgründen gesperrt.`);
    }
  }
}

/**
 * fetch mit Prüfung vor jedem Sprung. Weiterleitungen werden selbst verfolgt
 * (höchstens drei) und neu geprüft; führen sie auf einen anderen Host,
 * fällt der Authorization-Header weg – das Token geht nie an Fremde.
 */
export async function safeFetch(input: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  let url = new URL(input);
  const origin = url.host;
  const headers = new Headers(init.headers);
  for (let hop = 0; hop <= 3; hop++) {
    await assertFetchable(url);
    const res = await fetch(url, {
      ...init,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      if (url.host !== origin) {
        headers.delete("authorization");
        headers.delete("private-token");
      }
      continue;
    }
    return res;
  }
  throw new FetchBlockedError("Zu viele Weiterleitungen.");
}
