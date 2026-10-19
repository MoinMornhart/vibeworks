import type { Doc, Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { boardPreview, parseBoard } from "./docs/boardLogic";

// Mini-Docs: Seiten eines Kontos als Baum. Jede Abfrage filtert auf den
// Besitzer; fremde IDs verhalten sich wie nicht vorhandene.

const docTreeSelect = {
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

/** Mehr Leinwände zeigt die Übersicht nicht auf einmal – der Rest steht im Seitenbaum. */
const BOARDS_LIMIT = 200;

/**
 * Alle Leinwände eines Kontos für die Übersicht (#211). Der Inhalt wird hier
 * auf dem Server zu einem kleinen Abbild verdichtet – an den Browser gehen nur
 * Rahmen und Farben, kein Text, keine Striche, keine Bild-Kennungen.
 */
const boardSelect = { id: true, title: true, icon: true, kind: true, pinned: true, content: true, updatedAt: true } satisfies Prisma.DocSelect;
type BoardRow = Prisma.DocGetPayload<{ select: typeof boardSelect }>;

/** Eine Zeile der Übersicht: Abbild statt Inhalt, dazu wem sie gehört. */
function boardItem(d: BoardRow, extra: { mine: boolean; role?: "EDITOR" | "VIEWER"; ownerName?: string }) {
  const { content, ...rest } = d;
  return { ...rest, updatedAt: d.updatedAt.toISOString(), preview: boardPreview(parseBoard(content)), ...extra };
}
export type BoardOverviewItem = ReturnType<typeof boardItem>;

export async function loadBoards(ownerId: string): Promise<BoardOverviewItem[]> {
  const rows = await db.doc.findMany({
    where: { ownerId, kind: "BOARD" },
    select: boardSelect,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: BOARDS_LIMIT,
  });
  return rows.map((d) => boardItem(d, { mine: true }));
}

/** Leinwände, die andere mit mir geteilt haben (#211) – mit Besitzername und meiner Rolle. */
export async function loadSharedBoards(userId: string): Promise<BoardOverviewItem[]> {
  const rows = await db.docAccess.findMany({
    where: { userId, doc: { kind: "BOARD" } },
    select: { role: true, doc: { select: { ...boardSelect, owner: { select: { username: true, displayName: true } } } } },
    orderBy: { doc: { updatedAt: "desc" } },
    take: BOARDS_LIMIT,
  });
  return rows.map(({ role, doc }) => {
    const { owner, ...board } = doc;
    return boardItem(board, { mine: false, role, ownerName: owner.displayName || owner.username });
  });
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
