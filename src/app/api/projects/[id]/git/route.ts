import type { Prisma, Project } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject, type ProjectAccess } from "@/lib/access";
import { decrypt, encrypt, randomToken } from "@/lib/crypto";
import { guessProvider, parseRepoUrl, tokenHint, type GitProvider } from "@/lib/git/parse";
import { accountTokenFor, tokenCipherFor } from "@/lib/git/token";
import { serializeRepoCache, syncProjectRepository } from "@/lib/git/sync";
import { syncIssues } from "@/lib/git/issues";
import { GitError } from "@/lib/git/providers";
import { installWebhook, isPublicUrl, webhookUrl } from "@/lib/git/webhook";
import { tk } from "@/lib/i18n/messages";
import { repoAccessSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

type AccessProject = Pick<Project, "id" | "ownerId" | "repoUrl" | "repoTokenHint" | "issueSync" | "webhookSecretCipher" | "webhookAt">;

// Token- und Webhook-Angaben sieht nur der Besitzer; Mitglieder erfahren nur, ob gespiegelt wird.
async function accessInfo(project: AccessProject, access: ProjectAccess) {
  const owner = access === "OWNER";
  const account = owner ? await accountTokenFor(project.ownerId, project.repoUrl) : null;
  let webhook: { url: string; secret: string; receivedAt: string | null; publicUrl: boolean } | null = null;
  if (owner && project.webhookSecretCipher) {
    try {
      const url = webhookUrl(project.id);
      webhook = { url, secret: decrypt(project.webhookSecretCipher), receivedAt: project.webhookAt?.toISOString() ?? null, publicUrl: isPublicUrl(url) };
    } catch {
      webhook = null; // APP_SECRET geändert – dann eben neu einrichten
    }
  }
  return {
    tokenHint: owner ? project.repoTokenHint : null,
    issueSync: project.issueSync,
    accountToken: account ? { hint: account.hint, login: account.login } : null,
    webhook,
  };
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project, access } = await requireProject(user.id, (await params).id);
  const cache = await db.repoCache.findUnique({ where: { projectId: project.id } });
  return json({ cache: cache ? serializeRepoCache(cache) : null, access: await accessInfo(project, access) });
});

// Jetzt abgleichen: Commits und CI holen, danach Issues ↔ Aufgaben. Darf jedes
// Mitglied anstoßen. Fehler kommen als cache.error bzw. issues.error zurück.
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-sync:${user.id}`, 40, 10 * MINUTE);
  const { project } = await requireProject(user.id, (await params).id);
  if (!project.repoUrl) return json({ cache: null, issues: null });
  const cache = await syncProjectRepository(project);
  const issues = cache.error ? null : await syncIssues(project.id);
  return json({ cache: serializeRepoCache(cache), issues });
});

// Projekteigenes Token, Issue-Spiegelung und Webhook – nur der Besitzer.
export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-access:${user.id}`, 20, 10 * MINUTE);
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const input = await readBody(req, repoAccessSchema, { maxBytes: 4096 });

  const data: Prisma.ProjectUpdateInput = {};
  if (input.token !== undefined) {
    data.repoTokenCipher = input.token ? encrypt(input.token) : null;
    data.repoTokenHint = input.token ? tokenHint(input.token) : null;
  }
  if (input.issueSync !== undefined) data.issueSync = input.issueSync;
  const needsSecret = input.webhook === "renew" || ((input.webhook === "on" || input.webhook === "install") && !project.webhookSecretCipher);
  if (needsSecret) data.webhookSecretCipher = encrypt(randomToken(24));
  if (input.webhook === "off") {
    data.webhookSecretCipher = null;
    data.webhookAt = null;
  }
  const updated = await db.project.update({ where: { id: project.id }, data });

  if (input.webhook === "install") await install(updated);
  return json({ access: await accessInfo(updated, "OWNER"), installed: input.webhook === "install" });
});

/** Webhook mit dem hinterlegten Token beim Anbieter eintragen. */
async function install(project: Project) {
  const url = webhookUrl(project.id);
  if (!isPublicUrl(url)) throw new ApiError(400, tk("git", "webhook.errors.notPublic", { url }));
  const stored = await tokenCipherFor(project);
  if (!stored) throw new ApiError(400, tk("git", "webhook.errors.needToken"));
  const parsed = parseRepoUrl(project.repoUrl);
  const cache = await db.repoCache.findUnique({ where: { projectId: project.id }, select: { provider: true } });
  const provider = (cache?.provider || guessProvider(parsed?.host ?? "")) as GitProvider | "";
  if (!parsed || !provider) throw new ApiError(400, tk("git", "webhook.errors.noProvider"));
  try {
    await installWebhook(provider, parsed, decrypt(stored.cipher), url, decrypt(project.webhookSecretCipher!));
  } catch (err) {
    if (err instanceof GitError) throw new ApiError(400, err.status === 403 || err.status === 404 ? tk("git", "webhook.errors.noPermission") : err.message);
    throw err;
  }
}
