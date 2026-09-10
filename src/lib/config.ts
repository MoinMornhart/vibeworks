import path from "node:path";

// Konfiguration wird zur Laufzeit gelesen (nicht beim Build eingebacken),
// damit derselbe Build unter anderem Namen/anderer Adresse laufen kann.

function num(value: string | undefined, fallback: number, min = 0): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export const config = {
  get appName() {
    return process.env.APP_NAME?.trim() || "VibeWorks";
  },
  get appUrl() {
    return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  },
  get secret() {
    const s = process.env.APP_SECRET ?? "";
    if (s.length >= 32) return s;
    if (process.env.NODE_ENV === "production" && !warnedSecret) {
      warnedSecret = true;
      console.warn("[vibeworks] APP_SECRET fehlt oder ist kürzer als 32 Zeichen – unsicherer Ersatzschlüssel aktiv!");
    }
    return "vibeworks-dev-secret-bitte-in-der-env-setzen-0000";
  },
  get dataDir() {
    return path.resolve(process.env.DATA_DIR?.trim() || "./data");
  },
  get uploadDir() {
    return path.join(this.dataDir, "uploads");
  },
  get sessionTtlDays() {
    return num(process.env.SESSION_TTL_DAYS, 30, 1);
  },
  get sessionIdleHours() {
    return num(process.env.SESSION_IDLE_HOURS, 8, 0);
  },
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
};

let warnedSecret = false;
