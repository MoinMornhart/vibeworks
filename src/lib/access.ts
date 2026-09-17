import type { Project, ProjectRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";
import { allProjectPermissions, legacyLevel, permissionsOf, type ProjectPermission } from "@/lib/rolesLogic";
import { scopedProjectIds } from "@/lib/mcp/keyScope";

// Wer darf was an einem Projekt?
//   Besitzer – alles, auch Teilen nach außen, Repository, Token und Löschen
//   alle anderen – die Rechte ihrer Rollen (src/lib/rolesLogic.ts), zusammengenommen
//   aus direkter Mitgliedschaft und Team-Freigaben. Ohne Recht bleibt das Lesen.
// Fremde bekommen 404 – ob es ein Projekt gibt, verrät die API nicht.

/** Grobe Stufe für Anzeigen: Besitzer, darf etwas ändern, nur lesen. */
export type ProjectAccess = "OWNER" | ProjectRole;

/** Was eine Prüfung verlangt: Besitzer, bloßes Lesen oder ein bestimmtes Recht. */
export type Need = "OWNER" | "VIEWER" | ProjectPermission;

const ACCESS_LABEL: Record<ProjectAccess, string> = { OWNER: "Besitzer", EDITOR: "Bearbeiter", VIEWER: "Betrachter" };

/** Teams, in denen das Konto Mitglied ist. */
const inTeam = (userId: string) => ({ team: { members: { some: { userId } } } });

/** Prisma-Filter: Projekte, die das Konto besitzt, in denen es Mitglied ist oder die an eines seiner Teams freigegeben sind. */
export const visibleTo = (userId: string) => {
  const base = { OR: [{ ownerId: userId }, { members: { some: { userId } } }, { teams: { some: inTeam(userId) } }] };
  // Projekt-Schlüssel (#106): in dessen MCP-Aufruf nur die freigegebenen Projekte – als AND, damit ein id-Filter daneben bleibt
  const ids = scopedProjectIds();
  return ids ? { ...base, AND: [{ id: { in: ids } }] } : base;
};

const grantSelect = { role: true, roleRef: { select: { name: true, key: true, permissions: true } } } as const;

/** Für ein Prisma-select: die Vergaben an das Konto (direkt und über Teams) samt Rolle. */
export const roleSelect = (userId: string) => ({
  members: { where: { userId }, select: grantSelect },
  teams: { where: inTeam(userId), select: { ...grantSelect, team: { select: { name: true } } } },
});

type Grants = {
  members: Array<{ role: ProjectRole; roleRef: { permissions: string[] } | null }>;
  teams: Array<{ role: ProjectRole; roleRef: { permissions: string[] } | null }>;
};

export function permsFromGrants(ownerId: string, userId: string, g: Grants): Set<ProjectPermission> {
  return ownerId === userId ? allProjectPermissions() : permissionsOf([...g.members, ...g.teams]);
}

export function accessFromGrants(ownerId: string, userId: string, g: Grants): ProjectAccess {
  return ownerId === userId ? "OWNER" : legacyLevel(permissionsOf([...g.members, ...g.teams]));
}

export interface ProjectAccessInfo {
  project: Project;
  access: ProjectAccess;
  perms: Set<ProjectPermission>;
}

export function canDo(res: { access: ProjectAccess; perms: Set<ProjectPermission> }, need: Need): boolean {
  if (need === "VIEWER") return true;
  if (need === "OWNER") return res.access === "OWNER";
  return res.perms.has(need);
}

export async function accessOf(userId: string, projectId: string): Promise<ProjectAccessInfo | null> {
  const found = await db.project.findFirst({
    where: { id: projectId, ...visibleTo(userId) },
    include: roleSelect(userId),
  });
  if (!found) return null;
  const { members, teams, ...project } = found;
  const perms = permsFromGrants(project.ownerId, userId, { members, teams });
  return { project, access: project.ownerId === userId ? "OWNER" : legacyLevel(perms), perms };
}

function deny(need: Need): never {
  throw new ApiError(403, need === "OWNER" ? tk("projects", "errors.ownerOnly") : tk("projects", "errors.viewOnly"));
}

export async function requireProject(userId: string, projectId: string, need: Need = "VIEWER") {
  const res = await accessOf(userId, projectId);
  if (!res) throw notFound(tk("projects", "errors.notFound"));
  if (!canDo(res, need)) deny(need);
  return res;
}

export async function requireTask(userId: string, taskId: string, need: Need = "VIEWER") {
  const task = await db.task.findUnique({ where: { id: taskId } });
  const res = task && (await accessOf(userId, task.projectId));
  if (!task || !res) throw notFound(tk("projects", "errors.taskNotFound"));
  if (!canDo(res, need)) deny(need);
  return { task, ...res };
}

export async function requireNote(userId: string, noteId: string, need: Need = "VIEWER") {
  const note = await db.note.findUnique({ where: { id: noteId } });
  const res = note && (await accessOf(userId, note.projectId));
  if (!note || !res) throw notFound(tk("projects", "errors.noteNotFound"));
  if (!canDo(res, need)) deny(need);
  return { note, ...res };
}
