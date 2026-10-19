import type { Doc } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/apiError";
import { tk } from "@/lib/i18n/messages";

// Zugriff auf eine Leinwand/Seite (#211). Bisher gehörte jedes Dokument nur
// seinem Besitzer; jetzt kann der Besitzer bestimmte angemeldete Konten
// einladen – zum Ansehen oder zum Bearbeiten. Kein öffentlicher Zugriff.

export type DocRole = "OWNER" | "EDITOR" | "VIEWER";
export type DocNeed = "view" | "edit" | "own";

const ROLE_RANK: Record<DocRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
const NEED_RANK: Record<DocNeed, number> = { view: 1, edit: 2, own: 3 };

export interface DocWithRole {
  doc: Doc;
  role: DocRole;
}

/** Rolle eines Nutzers an einem Dokument – Besitzer, eingeladen oder gar keine. */
export async function docRoleOf(userId: string, id: string): Promise<DocWithRole | null> {
  const doc = await db.doc.findUnique({ where: { id }, include: { shares: { where: { userId }, select: { role: true } } } });
  if (!doc) return null;
  if (doc.ownerId === userId) return { doc, role: "OWNER" };
  const share = doc.shares[0];
  if (share) return { doc, role: share.role === "EDITOR" ? "EDITOR" : "VIEWER" };
  return null;
}

/**
 * Dokument laden und das nötige Recht prüfen. Fremde (unsichtbare) IDs sind 404
 * wie bisher; zu wenig Recht ist 403. „own“ ist dem Besitzer vorbehalten
 * (Löschen, Baum verschieben, Freigabe verwalten), „edit“ auch Bearbeitern.
 */
export async function requireDoc(userId: string, id: string, need: DocNeed = "view"): Promise<DocWithRole> {
  const res = await docRoleOf(userId, id);
  if (!res) throw notFound(tk("docs", "errors.notFound"));
  if (ROLE_RANK[res.role] < NEED_RANK[need]) throw new ApiError(403, tk("docs", "errors.viewOnly"));
  return res;
}
