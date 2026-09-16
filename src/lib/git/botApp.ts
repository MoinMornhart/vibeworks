import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { config } from "@/lib/config";
import { decrypt, encrypt, randomToken } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import type { ParsedRepo } from "./parse";
import { request } from "./providers";
import {
  appJwt,
  BOT_APP_API,
  BOT_APP_WEB,
  botAppInstallUrl,
  botAppLogin,
  botAppManifest,
  parseConversion,
  tokenStillFresh,
  validManifestCode,
} from "./botAppLogic";

// Bot als GitHub App (#Bot per Klick). Ablauf:
// 1. startBotApp: Formular-Ziel und Manifest für GitHub, dazu ein einmaliger state
// 2. GitHub legt die App an und springt mit code+state zurück → finishBotApp
// 3. Man installiert die App in den gewünschten Repositories
// 4. appIssueToken: für jedes Repository ein kurzlebiges Installations-Token

const STATE_TTL = 30 * 60_000;
const states = new Map<string, { userId: string; credentialId: string; expires: number }>();

const HEADERS = { "X-GitHub-Api-Version": "2022-11-28" };

function dropExpired(now: number) {
  for (const [key, s] of states) if (s.expires < now) states.delete(key);
}

/** Ziel und Inhalt für das Formular, das die Oberfläche an GitHub schickt. */
export async function startBotApp(userId: string, credentialId: string) {
  const cred = await db.gitCredential.findFirst({ where: { id: credentialId, userId }, select: { provider: true, baseUrl: true, login: true } });
  if (!cred) throw new ApiError(404, tk("account", "errors.connectionNotFound"));
  if (cred.provider !== "github" || cred.baseUrl !== BOT_APP_WEB) throw new ApiError(400, tk("account", "git.botAppOnlyGithub"));
  const now = Date.now();
  dropExpired(now);
  const state = randomToken(24);
  states.set(state, { userId, credentialId, expires: now + STATE_TTL });
  return {
    action: `${BOT_APP_WEB}/settings/apps/new?state=${encodeURIComponent(state)}`,
    manifest: JSON.stringify(botAppManifest(config.appUrl, cred.login)),
  };
}

/** Rücksprung von GitHub: Code gegen App-ID und Schlüssel tauschen. Liefert die Installationsseite. */
export async function finishBotApp(userId: string, code: unknown, state: unknown): Promise<string> {
  const now = Date.now();
  dropExpired(now);
  const pending = typeof state === "string" ? states.get(state) : undefined;
  // Nur wer den Ablauf selbst gestartet hat – der state gilt genau einmal
  if (!pending || pending.userId !== userId) throw new ApiError(400, tk("account", "git.botAppExpired"));
  states.delete(state as string);
  if (!validManifestCode(code)) throw new ApiError(400, tk("account", "git.botAppExpired"));

  const data = await request<unknown>("POST", `${BOT_APP_API}/app-manifests/${code}/conversions`, HEADERS);
  const app = parseConversion(data);
  if (!app) throw new ApiError(502, tk("account", "git.botAppFailed"));
  await db.gitCredential.updateMany({
    where: { id: pending.credentialId, userId },
    data: {
      botAppId: String(app.id),
      botAppSlug: app.slug,
      botAppKeyCipher: encrypt(app.pem),
      botLogin: botAppLogin(app.slug),
      botHint: app.slug,
      // Die App ersetzt einen früher eingetragenen Bot-Token
      botCipher: null,
    },
  });
  return botAppInstallUrl(app.slug);
}

const installTokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * Installations-Token der Bot-App für genau dieses Repository – null, wenn die
 * App dort nicht installiert ist. Dann laufen Issues wie früher über den
 * eigenen Zugang.
 */
export async function appIssueToken(app: { botAppId: string; botAppKeyCipher: string }, repo: ParsedRepo): Promise<string | null> {
  if (repo.host !== "github.com") return null;
  const key = `${app.botAppId}:${repo.path.toLowerCase()}`;
  const cached = installTokens.get(key);
  if (cached && tokenStillFresh(cached.expiresAt)) return cached.token;
  let pem: string;
  try {
    pem = decrypt(app.botAppKeyCipher);
  } catch {
    return null;
  }
  const auth = { ...HEADERS, Authorization: `Bearer ${appJwt(app.botAppId, pem)}` };
  try {
    const inst = await request<{ id: number }>("GET", `${BOT_APP_API}/repos/${repo.path}/installation`, auth);
    const res = await request<{ token: string; expires_at: string }>("POST", `${BOT_APP_API}/app/installations/${inst.id}/access_tokens`, auth);
    installTokens.set(key, { token: res.token, expiresAt: Date.parse(res.expires_at) });
    return res.token;
  } catch (err) {
    console.warn("[bot-app] %s:", repo.path, err instanceof Error ? err.message : err);
    return null;
  }
}
