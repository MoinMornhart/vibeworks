import type { Project, ProjectRole } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";

// Wer darf was an einem Projekt?
//   Besitzer   – alles, auch Teilen, Repository, Token und Löschen
//   Bearbeiter – Inhalte: Aufgaben, Notizen, Status, Beschreibung
//   Betrachter – nur lesen
// Fremde bekommen 404 – ob es ein Projekt gibt, verrät die API nicht.

export type ProjectAccess = "OWNER" | ProjectRole;

const RANK: Record<ProjectAccess, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const ACCESS_LABEL: Record<ProjectAccess, string> = { OWNER: "Besitzer", EDITOR: "Bearbeiter", VIEWER: "Betrachter" };

export function canAccess(access: ProjectAccess, min: ProjectAccess): boolean {
  return RANK[access] >= RANK[min];
}

/** Prisma-Filter: Projekte, die das Konto besitzt oder in denen es Mitglied ist. */
export const visibleTo = (userId: string) => ({ OR: [{ ownerId: userId }, { members: { some: { userId } } }] });

export async function accessOf(userId: string, projectId: string): Promise<{ project: Project; access: ProjectAccess } | null> {
  const found = await db.project.findFirst({
    where: { id: projectId, ...visibleTo(userId) },
    include: { members: { where: { userId }, select: { role: true } } },
  });
  if (!found) return null;
  const { members, ...project } = found;
  return { project, access: project.ownerId === userId ? "OWNER" : (members[0]?.role ?? "VIEWER") };
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
