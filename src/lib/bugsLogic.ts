// Fehler-Eingang ohne Datenbank: Berichte fremder Apps prüfen und begrenzen,
// gleichartige Fehler per Fingerabdruck zusammenfassen, Einbau-Schnipsel bauen.
// Alles, was hier ankommt, stammt von außen – also nur erwartete Typen, gekappt.

export const ERROR_STATUSES = ["open", "resolved", "ignored"] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

/** Größte angenommene Anfrage – ein Stapel oder ein Stück Log-Datei (#75). */
export const MAX_REPORT_BYTES = 128 * 1024;
/** Höchstens so viele Berichte je Anfrage. */
export const MAX_BATCH = 50;
/** Höchstens so viele verschiedene Fehler je Projekt – danach wird nur noch mitgezählt. */
export const MAX_GROUPS = 500;

export interface ErrorReport {
  message: string;
  type: string | null;
  stack: string | null;
  url: string | null;
  release: string | null;
  environment: string | null;
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

const asObject = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const first = (r: Record<string, unknown>, keys: string[], max: number) => {
  for (const k of keys) {
    const v = str(r[k], max);
    if (v) return v;
  }
  return null;
};

/** Zusatzangaben (z. B. Absturzgrund und Exit-Code) lesbar unter den Stack hängen. */
function detailsText(v: unknown): string | null {
  if (v === undefined || v === null || typeof v === "function") return null;
  try {
    const text = typeof v === "string" ? v : JSON.stringify(v);
    return text && text !== "{}" ? `Details: ${text.slice(0, 2000)}` : null;
  } catch {
    return null;
  }
}

/**
 * Bericht lesen: { message, type|name, stack, url, release|version, environment|env }
 * – ohne Meldung null. Versteht auch verschachtelte Fehler ({ error: { message, stack } }),
 * deutsche Feldnamen (nachricht, typ) und Zusatzangaben (details, daten) (#75).
 */
export function parseErrorReport(raw: unknown): ErrorReport | null {
  const outer = asObject(raw);
  if (!outer) return null;
  const inner = asObject(outer.error);
  const r = inner ? { ...outer, ...inner } : outer;
  const message = first(r, ["message", "error", "msg", "nachricht", "meldung", "text", "title"], 1000);
  if (!message) return null;
  const url = str(r.url, 500);
  const stack = first(r, ["stack", "stacktrace", "trace"], 8000);
  const details = detailsText(r.details ?? r.daten ?? r.data ?? r.extra);
  return {
    message,
    type: first(r, ["type", "name", "typ", "kind", "level", "stufe"], 100),
    stack: [stack, details].filter(Boolean).join("\n").slice(0, 10000) || null,
    url: url && /^https?:\/\//i.test(url) ? url : null,
    release: first(r, ["release", "version"], 60),
    environment: first(r, ["environment", "env", "umgebung"], 30),
  };
}

/** Stufen aus Log-Dateien, die als Fehler gelten. */
const LOG_LEVELS = new Set(["CRASH", "FATAL", "ERROR", "FEHLER", "PANIC"]);

/**
 * Log-Zeilen wie „2026-09-15T18:04:38Z [CRASH] Renderer weg {"grund":"crashed"}“ – nur
 * Fehler-Stufen, gleiche Zeilen einmal (#75).
 */
export function parseLogLines(text: string): ErrorReport[] {
  const seen = new Map<string, ErrorReport>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\S+\s+\[([A-Za-z-]{2,20})\]\s+(.+)$/.exec(line.slice(0, 4000));
    if (!m || !LOG_LEVELS.has(m[1].toUpperCase())) continue;
    const brace = m[2].indexOf(" {");
    const message = (brace > 0 ? m[2].slice(0, brace) : m[2]).trim().slice(0, 1000);
    if (!message) continue;
    const key = `${m[1]}\n${message}`;
    if (seen.has(key)) continue;
    seen.set(key, { message, type: m[1].toUpperCase(), stack: brace > 0 ? `Details: ${m[2].slice(brace + 1, brace + 2001)}` : null, url: null, release: null, environment: null });
    if (seen.size >= MAX_BATCH) break;
  }
  return [...seen.values()];
}

/**
 * Anfrage lesen: ein Bericht, eine Liste ([…] oder { reports: […] }) oder Log-Text.
 * Höchstens MAX_BATCH Berichte; „single“ hält die alte Antwortform für Einzelberichte.
 */
export function parseErrorBatch(text: string): { reports: ErrorReport[]; single: boolean; skipped: number } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const lines = parseLogLines(text);
    return lines.length ? { reports: lines, single: false, skipped: 0 } : null;
  }
  const obj = asObject(raw);
  const list = Array.isArray(raw) ? raw : obj && Array.isArray(obj.reports) ? obj.reports : obj && Array.isArray(obj.errors) ? obj.errors : null;
  if (!list) {
    const one = parseErrorReport(raw);
    return one ? { reports: [one], single: true, skipped: 0 } : null;
  }
  const reports = list.slice(0, MAX_BATCH).map(parseErrorReport).filter((r): r is ErrorReport => r !== null);
  return reports.length ? { reports, single: false, skipped: list.length - reports.length } : null;
}

/** Zahlen, Hex-Werte und IDs gleichmachen – „User 123 not found“ und „User 456 not found“ sind derselbe Fehler. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .trim();
}

const FRAME = /^at\s|^[\w$.<>[\]/]*@\S+:\d+/;

/** Oberste Stack-Zeile ohne Zeile, Spalte, Query und Build-Hash – bleibt über Deploys hinweg gleich. */
export function topFrame(stack: string | null): string {
  const line = (stack ?? "").split("\n").map((l) => l.trim()).find((l) => FRAME.test(l)) ?? "";
  return line
    .replace(/\?[^\s):]*/g, "")
    .replace(/:\d+(:\d+)?/g, "")
    .replace(/[.-][0-9a-f]{6,}(?=[./-])/gi, ".<hash>")
    .slice(0, 300);
}

/** Grundlage des Fingerabdrucks (der Server bildet daraus einen SHA-256). */
export function fingerprintSource(r: Pick<ErrorReport, "type" | "message" | "stack">): string {
  return [r.type ?? "", normalizeMessage(r.message), topFrame(r.stack)].join("\n");
}

/** Einbau-Schnipsel für Browser, Node.js und Skripte. */
export function snippets(endpoint: string): { browser: string; node: string; electron: string; curl: string } {
  const url = JSON.stringify(endpoint);
  const browser = `<script>
(function () {
  var url = ${url}, sent = 0;
  function send(e) {
    if (sent++ >= 20) return; // höchstens 20 Berichte je Seitenaufruf
    try {
      var body = JSON.stringify({ message: String((e && e.message) || e), type: e && e.name, stack: e && e.stack, url: location.href });
      if (navigator.sendBeacon) navigator.sendBeacon(url, body);
      else fetch(url, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
    } catch (_) {}
  }
  window.addEventListener("error", function (ev) { send(ev.error || { message: ev.message }); });
  window.addEventListener("unhandledrejection", function (ev) { send(ev.reason); });
})();
</script>`;
  const node = `// VibeWorks Fehler-Eingang (Node.js 18+)
const VIBEWORKS_ERRORS = ${url};
function reportError(err) {
  const e = err instanceof Error ? err : new Error(String(err));
  return fetch(VIBEWORKS_ERRORS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: e.message, type: e.name, stack: e.stack, environment: process.env.NODE_ENV }),
  }).catch(() => {});
}
process.on("unhandledRejection", (reason) => void reportError(reason));
process.on("uncaughtException", (err) => {
  console.error(err);
  reportError(err).finally(() => process.exit(1));
});`;
  const curl = `curl -X POST ${endpoint} \\
  -H "content-type: application/json" \\
  -d '{"message":"Backup fehlgeschlagen","type":"cron"}'`;
  // Electron: abgestürzte Renderer- und GPU-Prozesse melden. Gesammelt und alle 5 Sekunden als ein
  // Stapel verschickt – eine Absturzschleife schickt so keine Hunderte Anfragen (#75).
  const electron = `// VibeWorks Fehler-Eingang (Electron, Hauptprozess)
const { app } = require("electron");
const VIBEWORKS_ERRORS = ${url};
const pending = new Map(); // gleiche Abstürze nur einmal je Stapel
function reportError(message, type, stack, details) {
  const key = type + "|" + message;
  if (!pending.has(key) && pending.size < 50) pending.set(key, { message, type, stack, details, release: app.getVersion() });
}
function flush() {
  if (!pending.size) return Promise.resolve();
  const body = JSON.stringify([...pending.values()]);
  pending.clear();
  return fetch(VIBEWORKS_ERRORS, { method: "POST", headers: { "content-type": "application/json" }, body }).catch(() => {});
}
setInterval(flush, 5000).unref();
app.on("render-process-gone", (_event, _contents, d) => reportError("Renderer weg: " + d.reason, "crash", null, d));
app.on("child-process-gone", (_event, d) => reportError(d.type + "-Prozess weg: " + d.reason, "crash", null, d));
process.on("uncaughtException", (err) => {
  console.error(err);
  reportError(err.message, err.name, err.stack, null);
  flush().finally(() => app.exit(1));
});`;
  return { browser, node, electron, curl };
}
