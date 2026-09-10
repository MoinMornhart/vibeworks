import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { docUpdateSchema } from "@/lib/validation";
import { findOwnDoc, loadTree, moveAmongSiblings, nextDocPosition, serializeDoc, serializeTreeItem, wouldCreateCycle } from "@/lib/docs";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const doc = await findOwnDoc(user.id, (await params).id);
  if (!doc) throw notFound("Seite nicht gefunden");
  return json({ doc: serializeDoc(doc) });
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const current = await findOwnDoc(user.id, id);
  if (!current) throw notFound("Seite nicht gefunden");
  // Lange Seiten sind erlaubt – großzügigeres Limit als sonst.
  const input = await readBody(req, docUpdateSchema, { maxBytes: 2 * 1024 * 1024 });
  let structural = false;

  // Verschieben im Baum: bewusst ohne updatedAt – „Zuletzt bearbeitet“ soll
  // Inhalte meinen, nicht Aufräumen.
  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    if (input.parentId) {
      if (!(await findOwnDoc(user.id, input.parentId))) throw notFound("Übergeordnete Seite nicht gefunden");
      if (await wouldCreateCycle(user.id, id, input.parentId)) throw new ApiError(400, "Eine Seite kann nicht unter sich selbst oder einer ihrer Unterseiten liegen.");
    }
    const position = await nextDocPosition(user.id, input.parentId);
    await db.$executeRaw`UPDATE "Doc" SET "parentId" = ${input.parentId}, "position" = ${position} WHERE "id" = ${id}`;
    structural = true;
  } else if (input.move) {
    await moveAmongSiblings(user.id, current, input.move);
    structural = true;
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.content !== undefined) data.content = input.content;
  if (input.pinned !== undefined) data.pinned = input.pinned;
  const doc = Object.keys(data).length
    ? await db.doc.update({ where: { id }, data })
    : await db.doc.findUniqueOrThrow({ where: { id } });

  return json({
    doc: serializeDoc(doc),
    item: serializeTreeItem(doc),
    tree: structural ? await loadTree(user.id) : undefined,
  });
});

// Unterseiten gehen per Cascade mit.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { count } = await db.doc.deleteMany({ where: { id, ownerId: user.id } });
  if (!count) throw notFound("Seite nicht gefunden");
  return json({ ok: true, tree: await loadTree(user.id) });
});
