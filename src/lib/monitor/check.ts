import net from "node:net";
import tls from "node:tls";
import { assertFetchable, FetchBlockedError, safeFetch } from "@/lib/security/ssrf";
import { saveUpload, sniffImage } from "@/lib/uploads";
import { tk } from "@/lib/i18n/messages";

// Netzseite der Live-Überwachung – alles über den SSRF-Schutz: die Adresse
// trägt ein Mensch ein, abgerufen wird sie vom Server.

const UA = "VibeWorks-Monitor (+https://github.com/MoinMornhart/vibeworks)";
const MAX_HTML = 512 * 1024;
const MAX_COVER = 3 * 1024 * 1024;

export interface SiteResult {
  ok: boolean;
  status: number | null;
  ms: number | null;
  /** Meldung oder Übersetzungsschlüssel */
  error: string | null;
  html: string | null;
}

function describe(err: unknown): string {
  if (err instanceof FetchBlockedError) return err.message;
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return tk("live", "errors.timeout");
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (code) return code;
  }
  return tk("live", "errors.unreachable");
}

async function readLimited(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Seite abrufen: erreichbar heißt Antwort unter 400. Das HTML nur, wenn danach gefragt ist (Vorschaubild). */
export async function checkSite(url: string, wantHtml = false): Promise<SiteResult> {
  const started = performance.now();
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" }, timeoutMs: 15_000 });
    const ms = Math.round(performance.now() - started);
    let html: string | null = null;
    if (wantHtml && res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) {
      const bytes = await readLimited(res, MAX_HTML).catch(() => null);
      html = bytes ? new TextDecoder().decode(bytes) : null;
    } else {
      await res.body?.cancel().catch(() => undefined);
    }
    return { ok: res.status < 400, status: res.status, ms, error: res.status >= 400 ? `HTTP ${res.status}` : null, html };
  } catch (err) {
    return { ok: false, status: null, ms: null, error: describe(err), html: null };
  }
}

/** Ablaufdatum des Zertifikats – null ohne HTTPS oder wenn es nicht zu lesen ist. */
export async function sslExpiry(url: string): Promise<Date | null> {
  const u = new URL(url);
  if (u.protocol !== "https:") return null;
  await assertFetchable(u);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: Number(u.port) || 443, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false, timeout: 10_000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const date = cert?.valid_to ? new Date(cert.valid_to) : null;
        resolve(date && !Number.isNaN(date.getTime()) ? date : null);
      },
    );
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/** Vorschaubild laden und als Upload des Besitzers speichern – nur echte Rasterbilder (kein SVG). */
export async function fetchCover(ownerId: string, imageUrl: string) {
  const res = await safeFetch(imageUrl, { headers: { "User-Agent": UA, Accept: "image/*" }, timeoutMs: 15_000 });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const bytes = await readLimited(res, MAX_COVER);
  if (!bytes) return null;
  const kind = sniffImage(bytes);
  if (!kind) return null;
  return saveUpload(ownerId, bytes, kind, "cover");
}
