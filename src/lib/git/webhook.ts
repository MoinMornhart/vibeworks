import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import { config } from "@/lib/config";
import type { GitProvider, ParsedRepo } from "./parse";
import { apiBase, authHeaders, request } from "./providers";

// Eingehende Webhooks: GitHub, GitLab und Gitea/Forgejo melden neue Commits,
// Issue-Änderungen und CI-Läufe sofort – VibeWorks gleicht dann gleich ab,
// statt auf den nächsten Takt zu warten.

export function webhookUrl(projectId: string): string {
  return `${config.appUrl}/api/webhooks/git/${projectId}`;
}

/** Von außen erreichbar? localhost, private Netze und Namen ohne Punkt sind es nicht. */
export function isPublicUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (host === "localhost" || /\.(localhost|local|lan|home|internal)$/.test(host)) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === "::1" || /^f[cd]/.test(host) || host.startsWith("fe80")) return false;
  return host.includes(".") || host.includes(":");
}

export interface WebhookCheck {
  ok: boolean;
  /** Ereignis in Kleinbuchstaben, z. B. "push", "issues", "push hook", "ping" */
  event: string;
}

/**
 * Signatur prüfen: GitHub schickt X-Hub-Signature-256 ("sha256=" + HMAC),
 * Gitea/Forgejo X-Gitea-Signature (HMAC in Hex), GitLab das Geheimnis selbst
 * in X-Gitlab-Token.
 */
export function verifyWebhook(headers: Headers, rawBody: string, secret: string): WebhookCheck {
  const event = (headers.get("x-github-event") ?? headers.get("x-gitea-event") ?? headers.get("x-forgejo-event") ?? headers.get("x-gitlab-event") ?? "unknown").toLowerCase();
  const hmac = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const gitlab = headers.get("x-gitlab-token");
  const gitea = headers.get("x-gitea-signature") ?? headers.get("x-forgejo-signature");
  const github = headers.get("x-hub-signature-256");
  let ok = false;
  if (gitlab !== null) ok = safeEqual(gitlab, secret);
  else if (gitea) ok = safeEqual(gitea.toLowerCase(), hmac);
  else if (github) ok = safeEqual(github.toLowerCase(), `sha256=${hmac}`);
  return { ok, event };
}

interface Hook {
  id: number;
  url?: string;
  config?: { url?: string };
}

/**
 * Webhook beim Anbieter eintragen – oder einen vorhandenen mit derselben
 * Adresse auf den neuen Stand bringen. Braucht Admin-Rechte am Repository
 * (GitHub: Recht „admin:repo_hook“). Wirft GitError.
 */
export async function installWebhook(provider: GitProvider, repo: ParsedRepo, token: string, url: string, secret: string): Promise<void> {
  const api = apiBase(provider, repo);
  const headers = authHeaders(provider, token);
  const hooks = await request<Hook[]>("GET", `${api}/hooks`, headers);
  const existing = (hooks ?? []).find((h) => (h.config?.url ?? h.url) === url);

  if (provider === "gitlab") {
    const body = { url, token: secret, push_events: true, issues_events: true, pipeline_events: true, enable_ssl_verification: url.startsWith("https://") };
    if (existing) await request("PUT", `${api}/hooks/${existing.id}`, headers, body);
    else await request("POST", `${api}/hooks`, headers, body);
    return;
  }

  const hookConfig = { url, content_type: "json", secret, ...(provider === "github" ? { insecure_ssl: "0" } : {}) };
  const events = provider === "github" ? ["push", "issues", "workflow_run", "check_suite", "status"] : ["push", "issues", "status"];
  if (existing) {
    await request("PATCH", `${api}/hooks/${existing.id}`, headers, { active: true, events, config: hookConfig });
  } else {
    await request(
      "POST",
      `${api}/hooks`,
      headers,
      provider === "github" ? { name: "web", active: true, events, config: hookConfig } : { type: "gitea", active: true, events, config: hookConfig },
    );
  }
}
