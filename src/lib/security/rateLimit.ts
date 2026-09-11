import { ApiError } from "@/lib/api";
import { msgKey } from "@/lib/i18n/translate";

// Einfache Ratenbegrenzung mit gleitendem Fenster im Arbeitsspeicher.
// Reicht für eine einzelne Instanz; nach einem Neustart beginnt sie leer.

const buckets = new Map<string, number[]>();

export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    buckets.set(key, list);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0])) / 1000) };
  }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export function limitOrThrow(key: string, limit: number, windowMs: number) {
  const r = hit(key, limit, windowMs);
  if (!r.ok) {
    const minutes = Math.max(1, Math.ceil(r.retryAfter / 60));
    throw new ApiError(429, msgKey("errors.rateLimited", { n: minutes }));
  }
}

export const MINUTE = 60_000;
