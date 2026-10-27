import path from "node:path";
import { effectiveAppUrl, type StoredAppUrl } from "./appUrlLogic";

// Konfiguration wird zur Laufzeit gelesen (nicht beim Build eingebacken),
// damit derselbe Build unter anderem Namen/anderer Adresse laufen kann.

// Im Admin-Dashboard übernommene Adresse (siehe appUrlLogic.ts). Liegt auf
// globalThis, damit Instrumentation und Routen im selben Prozess denselben Wert sehen.
const appUrlStore = globalThis as unknown as { vwStoredAppUrl?: StoredAppUrl };

/** Gespeicherte Adresse aus den Instanz-Einstellungen übernehmen (beim Start und nach jedem Lesen). */
export function setStoredAppUrl(stored: StoredAppUrl | null): void {
  appUrlStore.vwStoredAppUrl = stored ? { appUrl: stored.appUrl, appUrlEnv: stored.appUrlEnv } : undefined;
}

function num(value: string | undefined, fallback: number, min = 0): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** Mindestlänge für APP_SECRET – darunter kommt der unsichere Ersatzschlüssel. */
const SECRET_MIN_LENGTH = 32;
/** Standard-Sitzungsdauer in Tagen (Höchstdauer). */
const SESSION_TTL_DAYS_DEFAULT = 30;
/** Standard-Leerlauf in Stunden, nach dem eine Sitzung abläuft. */
const SESSION_IDLE_HOURS_DEFAULT = 8;

export const config = {
  get appName() {
    return process.env.APP_NAME?.trim() || "VibeWorks";
  },
  /** APP_URL aus der .env – Grundwert und Rettungsweg. */
  get envAppUrl() {
    // Schlusssatz-Schrägstriche abschneiden: trifft "…/" und "…///", nicht "…/pfad".
    // https://regex101.com/?regex=%5C%2F%2B%24&testString=http%3A%2F%2Fa%2F%2F%2F
    return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  },
  /** Geltende Adresse: im Admin-Dashboard übernommen, sonst APP_URL. */
  get appUrl() {
    return effectiveAppUrl(this.envAppUrl, appUrlStore.vwStoredAppUrl);
  },
  get secret() {
    const s = process.env.APP_SECRET ?? "";
    if (s.length >= SECRET_MIN_LENGTH) return s;
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
    return num(process.env.SESSION_TTL_DAYS, SESSION_TTL_DAYS_DEFAULT, 1);
  },
  get sessionIdleHours() {
    return num(process.env.SESSION_IDLE_HOURS, SESSION_IDLE_HOURS_DEFAULT, 0);
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
  /**
   * Zugriff ins private LAN sperren. Standard: gesperrt – sonst kann ein
   * Projekt-Bearbeiter den Server über eine Live-URL oder Repo-Adresse das
   * Heimnetz abklopfen lassen (SSRF). Wer ein selbst gehostetes Gitea oder eine
   * Live-Seite im eigenen Netz prüfen lässt, setzt GIT_BLOCK_PRIVATE=false.
   */
  get gitBlockPrivate(): boolean {
    return process.env.GIT_BLOCK_PRIVATE !== "false";
  },
  /**
   * Wie viele vertrauenswürdige Proxys vor der App stehen (Standard 1: der
   * Proxmox-Reverse-Proxy). Aus X-Forwarded-For wird der Eintrag genommen, den
   * der äußerste vertrauenswürdige Proxy gesetzt hat – alles, was der Client
   * selbst davorschreibt, zählt nicht. 0 heißt: X-Forwarded-For nicht vertrauen.
   */
  get trustedProxyHops(): number {
    return num(process.env.TRUSTED_PROXY_HOPS, 1, 0);
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
