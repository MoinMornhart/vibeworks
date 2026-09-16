import { createSign } from "node:crypto";

// Bot als GitHub App per Klick (Manifest-Ablauf): VibeWorks schickt GitHub
// eine fertige App-Beschreibung, GitHub legt die App an und gibt einen Code
// zurück, den VibeWorks gegen App-ID und Schlüssel tauscht. Die App darf nur
// Issues schreiben und Metadaten lesen – kein Code, keine Webhooks.

/** Nur github.com – GitHub Enterprise behält den Token-Weg. */
export const BOT_APP_WEB = "https://github.com";
export const BOT_APP_API = "https://api.github.com";

export interface BotAppManifest {
  name: string;
  url: string;
  redirect_url: string;
  setup_url: string;
  description: string;
  public: false;
  default_permissions: { issues: "write"; metadata: "read" };
  default_events: [];
}

/** App-Namen sind bei GitHub weltweit eindeutig und höchstens 34 Zeichen lang. */
export function botAppName(login: string | null): string {
  const clean = (login ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  return clean ? `vibeworks-${clean}` : "vibeworks-bot";
}

export function botAppManifest(appUrl: string, login: string | null): BotAppManifest {
  return {
    name: botAppName(login),
    url: appUrl,
    redirect_url: `${appUrl}/api/account/git-credentials/bot-app/callback`,
    setup_url: `${appUrl}/account?bot=ready#git-zugang`,
    description: "VibeWorks legt damit Issues an und hält ihre Status-Labels aktuell.",
    public: false,
    default_permissions: { issues: "write", metadata: "read" },
    default_events: [],
  };
}

/** Der Code aus dem Rücksprung landet in einer URL – nur harmlose Zeichen zulassen. */
export const validManifestCode = (code: unknown): code is string => typeof code === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(code);

/** Seite, auf der man die App in Repositories installiert. */
export const botAppInstallUrl = (slug: string) => `${BOT_APP_WEB}/apps/${encodeURIComponent(slug)}/installations/new`;
/** Einstellungen der App – dort lässt sie sich löschen. */
export const botAppSettingsUrl = (slug: string) => `${BOT_APP_WEB}/settings/apps/${encodeURIComponent(slug)}/advanced`;
/** So erscheint die App als Verfasser von Issues. */
export const botAppLogin = (slug: string) => `${slug}[bot]`;

/** Antwort von POST /app-manifests/{code}/conversions – nur die Felder, die VibeWorks braucht. */
export interface ManifestConversion {
  id: number;
  slug: string;
  pem: string;
}

export function parseConversion(data: unknown): ManifestConversion | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "number" || typeof d.slug !== "string" || typeof d.pem !== "string") return null;
  if (!/^[a-z0-9-]{1,40}$/.test(d.slug) || !d.pem.includes("PRIVATE KEY")) return null;
  return { id: d.id, slug: d.slug, pem: d.pem };
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** Kurzlebiges JWT (RS256), mit dem sich die App selbst bei GitHub ausweist – höchstens 10 Minuten gültig. */
export function appJwt(appId: string, pem: string, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // 60 Sekunden zurück: Uhren gehen nicht überall gleich
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(pem);
  return `${head}.${body}.${b64url(signature)}`;
}

/** Installations-Token merken, bis fünf Minuten vor Ablauf. */
export function tokenStillFresh(expiresAt: number, nowMs = Date.now()): boolean {
  return expiresAt - nowMs > 5 * 60_000;
}
