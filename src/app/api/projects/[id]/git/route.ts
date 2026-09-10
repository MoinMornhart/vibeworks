import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject, type ProjectAccess } from "@/lib/access";
import { encrypt } from "@/lib/crypto";
import { tokenHint } from "@/lib/git/parse";
import { serializeRepoCache, syncProjectRepository } from "@/lib/git/sync";
import { syncIssues } from "@/lib/git/issues";
import { repoAccessSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Token-Hinweis sieht nur der Besitzer; Mitglieder erfahren nur, ob gespiegelt wird.
const accessOf = (p: { repoTokenHint: string | null; issueSync: boolean }, access: ProjectAccess) => ({
  tokenHint: access === "OWNER" ? p.repoTokenHint : null,
  issueSync: p.issueSync,
});

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project, access } = await requireProject(user.id, (await params).id);
  const cache = await db.repoCache.findUnique({ where: { projectId: project.id } });
  return json({ cache: cache ? serializeRepoCache(cache) : null, access: accessOf(project, access) });
});

// Jetzt abgleichen: Commits holen, danach Issues ↔ Aufgaben. Darf jedes
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

// Zugangstoken setzen/entfernen, Issue-Spiegelung an/aus – nur der Besitzer.
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
  const updated = await db.project.update({ where: { id: project.id }, data, select: { repoTokenHint: true, issueSync: true } });
  return json({ access: accessOf(updated, "OWNER") });
});
