import type { Note } from "@prisma/client";
import { db } from "./db";
import { truncate } from "./utils";

export function serializeNote(n: Note) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    // „bearbeitet“ nur bei echter Änderung – Anpinnen fasst updatedAt nicht an.
    edited: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
  };
}
export type NoteItem = ReturnType<typeof serializeNote>;

export function noteLabel(n: { title: string | null; content: string }): string {
  return truncate(n.title?.trim() || n.content.trim().split("\n")[0].replace(/^[#>\-*\s[\]x]+/i, "") || "Notiz", 60);
}

export async function findOwnNote(ownerId: string, id: string) {
  return db.note.findFirst({ where: { id, project: { ownerId } } });
}

/** Neue Aktivität am Projekt – für die Sortierung „Zuletzt geändert“. */
export async function touchProject(projectId: string) {
  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
}

export const NOTE_ORDER = [{ pinned: "desc" as const }, { createdAt: "desc" as const }];
