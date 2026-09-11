import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/messages";

// Kleiner Fetch-Helfer für Client-Komponenten: JSON rein, JSON raus,
// verständliche Fehler mit Feldfehlern.

// Kein Hook verfügbar – die Sprache steht im lang-Attribut von <html>
// (setzt das Root-Layout).
function tr() {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return makeT(isLocale(lang) ? lang : DEFAULT_LOCALE, "shell");
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(res.status, data?.error ?? tr()("api.httpError", { status: res.status }), data?.fieldErrors ?? {});
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error && err.name === "AbortError") return tr()("api.aborted");
  return tr()("api.network");
}
