import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

// Gemeinsamer Rahmen für alle API-Routen: CSRF-Prüfung bei schreibenden
// Methoden, JSON-Body mit Größenlimit und Zod-Validierung, einheitliche
// Fehlerantworten. Fremde IDs beantworten die Routen mit 404, nicht 403.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Nicht gefunden") => new ApiError(404, what);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY = 256 * 1024;

/** Schreibende Anfragen müssen von der eigenen Seite kommen. */
export function assertSameOrigin(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "Anfrage von fremder Herkunft abgewiesen");
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* ungültig → abweisen */
    }
    if (!host || originHost !== host) throw new ApiError(403, "Anfrage von fremder Herkunft abgewiesen");
  }
}

export async function readBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Erwartet Content-Type: application/json");
  }
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ApiError(413, "Anfrage zu groß");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "Ungültiges JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= issue.message;
    }
    const first = Object.values(fieldErrors)[0];
    throw new ApiError(400, first ?? "Ungültige Eingabe", fieldErrors);
  }
  return parsed.data;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unbekannt";
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

export function route<P = Record<string, never>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, fieldErrors: err.fieldErrors }, { status: err.status });
      }
      // redirect()/notFound() aus next/navigation durchreichen
      if (err && typeof err === "object" && "digest" in err) throw err;
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return json({ error: "Interner Fehler" }, { status: 500 });
    }
  };
}
