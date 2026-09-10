import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { tokenHint } from "@/lib/git/parse";
import { serializeRepoCache, syncProjectRepository } from "@/lib/git/sync";
import { syncIssues } from "@/lib/git/issues";
import { repoAccessSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const accessSelect = { id: true, repoUrl: true, repoTokenCipher: true, repoTokenHint: true, issueSync: true } as const;

async function ownProject(userId: string, id: string) {
  const project = await db.project.findFirst({ where: { id, ownerId: userId }, select: accessSelect });
  if (!project) throw notFound("Projekt nicht gefunden");
  return project;
}

const accessOf = (p: { repoTokenHint: string | null; issueSync: boolean }) => ({ tokenHint: p.repoTokenHint, issueSync: p.issueSync });

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const project = await ownProject(user.id, (await params).id);
  const cache = await db.repoCache.findUnique({ where: { projectId: project.id } });
  return json({ cache: cache ? serializeRepoCache(cache) : null, access: accessOf(project) });
});

// Jetzt abgleichen: Commits holen, danach Issues ↔ Aufgaben. Fehler kommen
// als cache.error bzw. issues.error zurück, nicht als HTTP-Fehler.
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-sync:${user.id}`, 40, 10 * MINUTE);
  const project = await ownProject(user.id, (await params).id);
  if (!project.repoUrl) return json({ cache: null, issues: null });
  const cache = await syncProjectRepository(project);
  const issues = cache.error ? null : await syncIssues(project.id);
  return json({ cache: serializeRepoCache(cache), issues });
});

// Zugangstoken setzen/entfernen, Issue-Spiegelung an/aus.
export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-access:${user.id}`, 20, 10 * MINUTE);
  const project = await ownProject(user.id, (await params).id);
  const input = await readBody(req, repoAccessSchema, { maxBytes: 4096 });

  const data: Prisma.ProjectUpdateInput = {};
  if (input.token !== undefined) {
    data.repoTokenCipher = input.token ? encrypt(input.token) : null;
    data.repoTokenHint = input.token ? tokenHint(input.token) : null;
  }
  if (input.issueSync !== undefined) data.issueSync = input.issueSync;
  const updated = await db.project.update({ where: { id: project.id }, data, select: accessSelect });
  return json({ access: accessOf(updated) });
});
