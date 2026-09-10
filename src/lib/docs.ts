import type { Doc, Prisma } from "@prisma/client";
import { db } from "./db";

// Mini-Docs: Seiten eines Kontos als Baum. Jede Abfrage filtert auf den
// Besitzer; fremde IDs verhalten sich wie nicht vorhandene.

export const docTreeSelect = {
  id: true,
  parentId: true,
  title: true,
  icon: true,
  kind: true,
  share: true,
  position: true,
  pinned: true,
  updatedAt: true,
} satisfies Prisma.DocSelect;

type DocTreeRow = Prisma.DocGetPayload<{ select: typeof docTreeSelect }>;

export function serializeTreeItem(d: DocTreeRow) {
  return { ...d, updatedAt: d.updatedAt.toISOString() };
}
export type DocTreeItem = ReturnType<typeof serializeTreeItem>;

export function serializeDoc(d: Doc) {
  return {
    id: d.id,
    parentId: d.parentId,
    kind: d.kind,
    title: d.title,
    icon: d.icon,
    content: d.content,
    sourceUrl: d.sourceUrl,
    archive: d.archive,
    archivedAt: d.archivedAt?.toISOString() ?? null,
    pinned: d.pinned,
    share: d.share,
    shareToken: d.shareToken,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}
export type DocDetail = ReturnType<typeof serializeDoc>;

export async function loadTree(ownerId: string): Promise<DocTreeItem[]> {
  const rows = await db.doc.findMany({
    where: { ownerId },
    select: docTreeSelect,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serializeTreeItem);
}

export async function findOwnDoc(ownerId: string, id: string) {
  return db.doc.findFirst({ where: { id, ownerId } });
}

export async function nextDocPosition(ownerId: string, parentId: string | null): Promise<number> {
  const last = await db.doc.findFirst({ where: { ownerId, parentId }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? -1) + 1;
}

/**
 * Läge docId unter newParentId, entstünde ein Kreis? Geht von der neuen
 * Elternseite nach oben – taucht dabei die Seite selbst auf, ist es einer.
 */
export async function wouldCreateCycle(ownerId: string, docId: string, newParentId: string): Promise<boolean> {
  let current: string | null = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === docId || seen.has(current)) return true;
    seen.add(current);
    const row: { parentId: string | null } | null = await db.doc.findFirst({ where: { id: current, ownerId }, select: { parentId: true } });
    current = row?.parentId ?? null;
  }
  return false;
}

/** Eine Stufe nach oben oder unten unter den Geschwistern – ohne updatedAt anzufassen. */
export async function moveAmongSiblings(ownerId: string, doc: Pick<Doc, "id" | "parentId">, direction: "up" | "down") {
  const siblings = await db.doc.findMany({
    where: { ownerId, parentId: doc.parentId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const ids = siblings.map((s) => s.id);
  const i = ids.indexOf(doc.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await db.$transaction(ids.map((id, position) => db.$executeRaw`UPDATE "Doc" SET "position" = ${position} WHERE "id" = ${id}`));
}
