import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { accessOf, roleSelect, visibleTo, permsFromGrants } from "@/lib/access";
import { displayNameOf } from "@/lib/auth/guard";
import { makeT, tk } from "@/lib/i18n/messages";
import { appLink, notifyUser } from "@/lib/notify";

// Projekt-Schlüssel (#106) mit Datenbank: wer welche Projekte freigeben darf,
// Besitzer benachrichtigen, Zugriff widerrufen.

/** Freigeben darf der Besitzer und wer Mitglieder einladen darf (z. B. Team-Admins). */
export async function grantableProjects(userId: string) {
  const rows = await db.project.findMany({
    where: { ...visibleTo(userId), buriedAt: null, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, ownerId: true, owner: { select: { username: true, displayName: true } }, ...roleSelect(userId) },
    orderBy: { name: "asc" },
    take: 500,
  });
  return rows
    .filter((p) => p.ownerId === userId || permsFromGrants(p.ownerId, userId, p).has("members.invite"))
    .map((p) => ({ id: p.id, name: p.name, own: p.ownerId === userId, owner: displayNameOf(p.owner) }));
}

export async function checkGrantable(userId: string, ids: string[]) {
  const projects = [];
  for (const id of new Set(ids)) {
    const res = await accessOf(userId, id);
    if (!res) throw new ApiError(404, tk("projects", "errors.notFound"));
    if (res.access !== "OWNER" && !res.perms.has("members.invite")) throw new ApiError(403, tk("mcp", "projectKey.notAllowed", { name: res.project.name }));
    projects.push(res.project);
  }
  return projects;
}

/** Besitzer fremder Projekte erfahren von jedem neuen Schlüssel – mit Weg zum Widerruf. */
export async function notifyOwners(userId: string, keyName: string, projects: Array<{ id: string; name: string; ownerId: string }>) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
  const who = user ? displayNameOf(user) : "?";
  for (const p of projects) {
    if (p.ownerId === userId) continue;
    await notifyUser(p.ownerId, "accessRequest", (_t, locale) => {
      const t = makeT(locale, "mcp");
      return {
        event: "accessRequest",
        title: t("projectKey.notifyTitle", { project: p.name }),
        message: t("projectKey.notifyMessage", { user: who, key: keyName }),
        url: appLink(`/projects/${p.id}#ki-schluessel`),
        priority: "high",
      };
    });
  }
}

/** Schlüssel mit Zugriff auf ein Projekt – für dessen Besitzer. */
export async function keysForProject(projectId: string) {
  const rows = await db.apiToken.findMany({
    where: { projectScoped: true, projectIds: { has: projectId } },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    hint: t.hint,
    user: displayNameOf(t.user),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
    paused: Boolean(t.disabledAt),
    createdAt: t.createdAt.toISOString(),
  }));
}

/** Ein Projekt aus einem Schlüssel entfernen – der Schlüssel behält die übrigen. */
export async function revokeProjectFromKey(projectId: string, tokenId: string, byUserId: string) {
  const token = await db.apiToken.findFirst({ where: { id: tokenId, projectScoped: true, projectIds: { has: projectId } } });
  if (!token) throw new ApiError(404, tk("mcp", "errors.notFound"));
  await db.apiToken.update({ where: { id: token.id }, data: { projectIds: token.projectIds.filter((id) => id !== projectId) } });
  if (token.userId !== byUserId) {
    const [by, project] = await Promise.all([
      db.user.findUnique({ where: { id: byUserId }, select: { username: true, displayName: true } }),
      db.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    ]);
    await notifyUser(token.userId, "accessRequest", (_t, locale) => {
      const t = makeT(locale, "mcp");
      return {
        event: "accessRequest",
        title: t("projectKey.revokedTitle", { project: project?.name ?? "?" }),
        message: t("projectKey.revokedMessage", { user: by ? displayNameOf(by) : "?", key: token.name }),
        url: appLink("/account#mcp"),
      };
    });
  }
}
