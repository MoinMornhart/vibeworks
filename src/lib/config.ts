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
  /** Update per Knopfdruck: hier legt die App Anfragen ab (setzt der update-Befehl). */
  get updateControlDir(): string | null {
    return process.env.VIBEWORKS_CONTROL_DIR?.trim() || null;
  },
  /** …und hier liest sie Status und Log (schreibt nur root). */
  get updateStatusDir(): string | null {
    return process.env.VIBEWORKS_STATUS_DIR?.trim() || null;
  },
  /** Git-Instanz auf demselben Rechner erlauben (sonst ist Loopback gesperrt). */
  get gitAllowLoopback(): boolean {
    return process.env.GIT_ALLOW_LOOPBACK === "true";
  },
  /** Zugriff ins private LAN sperren (Standard: erlaubt – selbst gehostetes Gitea). */
  get gitBlockPrivate(): boolean {
    return process.env.GIT_BLOCK_PRIVATE === "true";
  },
  /** Demo-Instanz: alles schreibgeschützt, Beispieldaten, jede Nacht neu angelegt. */
  get demoMode(): boolean {
    return process.env.DEMO_MODE === "true";
  },
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
};

let warnedSecret = false;
