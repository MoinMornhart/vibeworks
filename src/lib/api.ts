import { NextResponse, type NextRequest } from "next/server";
import type { z, ZodTypeAny } from "zod";
import { msgKey } from "./i18n/translate";
import { config } from "./config";
import { demoAllows } from "./demoGuard";

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

// Meldungen dürfen Übersetzungsschlüssel sein ("projects.errors.notFound",
// siehe tk()); route() übersetzt sie in die Sprache der Anfrage.
export const notFound = (what = "errors.notFound") => new ApiError(404, what);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY = 256 * 1024;

/** Schreibende Anfragen müssen von der eigenen Seite kommen. */
export function assertSameOrigin(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "errors.foreignOrigin");
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
    if (!host || originHost !== host) throw new ApiError(403, "errors.foreignOrigin");
  }
}

/** Liefert den Ausgabetyp des Schemas – also nach Defaults und Transformationen. */
export async function readBody<S extends ZodTypeAny>(req: NextRequest, schema: S, opts: { maxBytes?: number } = {}): Promise<z.output<S>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "errors.contentType");
  }
  const text = await req.text();
  if (text.length > (opts.maxBytes ?? MAX_BODY)) throw new ApiError(413, "errors.tooLarge");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "errors.invalidJson");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      // Eigene Meldungen der Schemas sind Übersetzungsschlüssel (validation.*);
      // für Zods englische Standardtexte gibt es allgemeine Schlüssel.
      const message =
        issue.code === "invalid_type" && issue.received === "undefined"
          ? msgKey("errors.required", { field: key })
          : issue.code === "invalid_type"
            ? msgKey("errors.invalidValue", { field: key })
            : issue.message;
      fieldErrors[key] ??= message;
    }
    const first = Object.values(fieldErrors)[0];
    throw new ApiError(400, first ?? "errors.invalidInput", fieldErrors);
  }
  return parsed.data;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? "unbekannt");
  // IPv4 im IPv6-Gewand (::ffff:192.168.1.5) lesbar machen
  return ip.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

export function route<P = Record<string, never>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      // Demo-Instanz: schreibgeschützt bis auf An-/Abmelden und Sprache
      if (config.demoMode && !demoAllows(req.method, req.nextUrl.pathname)) throw new ApiError(403, "errors.demoReadOnly");
      return await fn(req, ctx);
    } catch (err) {
      // redirect()/notFound() aus next/navigation durchreichen
      if (!(err instanceof ApiError) && err && typeof err === "object" && "digest" in err) throw err;
      // Erst hier laden: der Übersetzer braucht die Sitzung, die wiederum ApiError kennt.
      const { translateForRequest } = await import("./i18n/server");
      const tr = (text: string) => translateForRequest(text).catch(() => text);
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors
          ? Object.fromEntries(await Promise.all(Object.entries(err.fieldErrors).map(async ([k, v]) => [k, await tr(v)] as const)))
          : undefined;
        return json({ error: await tr(err.message), fieldErrors }, { status: err.status });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return json({ error: await tr("errors.internal") }, { status: 500 });
    }
  };
}
