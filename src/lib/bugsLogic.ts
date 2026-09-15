// Fehler-Eingang ohne Datenbank: Berichte fremder Apps prüfen und begrenzen,
// gleichartige Fehler per Fingerabdruck zusammenfassen, Einbau-Schnipsel bauen.
// Alles, was hier ankommt, stammt von außen – also nur erwartete Typen, gekappt.

export const ERROR_STATUSES = ["open", "resolved", "ignored"] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

/** Größter angenommener Bericht. */
export const MAX_REPORT_BYTES = 32 * 1024;
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

/** Bericht lesen: { message, type|name, stack, url, release|version, environment|env } – ohne message null. */
export function parseErrorReport(raw: unknown): ErrorReport | null {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const message = str(r.message, 1000) ?? str(r.error, 1000);
  if (!message) return null;
  const url = str(r.url, 500);
  return {
    message,
    type: str(r.type, 100) ?? str(r.name, 100),
    stack: str(r.stack, 8000),
    url: url && /^https?:\/\//i.test(url) ? url : null,
    release: str(r.release, 60) ?? str(r.version, 60),
    environment: str(r.environment, 30) ?? str(r.env, 30),
  };
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
export function snippets(endpoint: string): { browser: string; node: string; curl: string } {
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
  return { browser, node, curl };
}
