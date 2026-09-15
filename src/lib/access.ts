import type { Project, ProjectRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";
import { bestRole } from "@/lib/teamsLogic";

// Wer darf was an einem Projekt?
//   Besitzer   – alles, auch Teilen, Repository, Token und Löschen
//   Bearbeiter – Inhalte: Aufgaben, Notizen, Status, Beschreibung
//   Betrachter – nur lesen
// Rollen kommen aus direkter Mitgliedschaft oder aus Team-Freigaben – es gilt die stärkere.
// Fremde bekommen 404 – ob es ein Projekt gibt, verrät die API nicht.

export type ProjectAccess = "OWNER" | ProjectRole;

const RANK: Record<ProjectAccess, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const ACCESS_LABEL: Record<ProjectAccess, string> = { OWNER: "Besitzer", EDITOR: "Bearbeiter", VIEWER: "Betrachter" };

export function canAccess(access: ProjectAccess, min: ProjectAccess): boolean {
  return RANK[access] >= RANK[min];
}

/** Teams, in denen das Konto Mitglied ist. */
const inTeam = (userId: string) => ({ team: { members: { some: { userId } } } });

/** Prisma-Filter: Projekte, die das Konto besitzt, in denen es Mitglied ist oder die an eines seiner Teams freigegeben sind. */
export const visibleTo = (userId: string) => ({ OR: [{ ownerId: userId }, { members: { some: { userId } } }, { teams: { some: inTeam(userId) } }] });

/** Für ein Prisma-select: die Rollen des Kontos an einem Projekt (direkt und über Teams). */
export const roleSelect = (userId: string) => ({
  members: { where: { userId }, select: { role: true } },
  teams: { where: inTeam(userId), select: { role: true, team: { select: { name: true } } } },
});

/** Zugriff aus den Rollen: Besitzer, sonst die stärkere aus direkter Mitgliedschaft und Teams. */
export function accessFromRoles(ownerId: string, userId: string, rows: { members: Array<{ role: ProjectRole }>; teams: Array<{ role: ProjectRole }> }): ProjectAccess {
  if (ownerId === userId) return "OWNER";
  return bestRole([...rows.members, ...rows.teams].map((r) => r.role)) ?? "VIEWER";
}

export async function accessOf(userId: string, projectId: string): Promise<{ project: Project; access: ProjectAccess } | null> {
  const found = await db.project.findFirst({
    where: { id: projectId, ...visibleTo(userId) },
    include: roleSelect(userId),
  });
  if (!found) return null;
  const { members, teams, ...project } = found;
  return { project, access: accessFromRoles(project.ownerId, userId, { members, teams }) };
}

function deny(min: ProjectAccess): never {
  throw new ApiError(403, min === "OWNER" ? tk("projects", "errors.ownerOnly") : tk("projects", "errors.viewOnly"));
}

export async function requireProject(userId: string, projectId: string, min: ProjectAccess = "VIEWER") {
  const res = await accessOf(userId, projectId);
  if (!res) throw notFound(tk("projects", "errors.notFound"));
  if (!canAccess(res.access, min)) deny(min);
  return res;
}

export async function requireTask(userId: string, taskId: string, min: ProjectAccess = "VIEWER") {
  const task = await db.task.findUnique({ where: { id: taskId } });
  const res = task && (await accessOf(userId, task.projectId));
  if (!task || !res) throw notFound(tk("projects", "errors.taskNotFound"));
  if (!canAccess(res.access, min)) deny(min);
  return { task, ...res };
}

export async function requireNote(userId: string, noteId: string, min: ProjectAccess = "VIEWER") {
  const note = await db.note.findUnique({ where: { id: noteId } });
  const res = note && (await accessOf(userId, note.projectId));
  if (!note || !res) throw notFound(tk("projects", "errors.noteNotFound"));
  if (!canAccess(res.access, min)) deny(min);
  return { note, ...res };
}
