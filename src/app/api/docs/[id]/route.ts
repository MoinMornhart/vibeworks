import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { docUpdateSchema } from "@/lib/validation";
import { findOwnDoc, loadTree, moveAmongSiblings, nextDocPosition, serializeDoc, serializeTreeItem, wouldCreateCycle } from "@/lib/docs";
import { requireDoc } from "@/lib/docs/access";
import { publishDoc } from "@/lib/docs/liveBus";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

/** Größeres Limit für lange Seiten/Leinwände. */
const MAX_DOC_BYTES = 2 * 1024 * 1024;

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  // Ansehen reicht – auch eingeladene Konten (#211). Die Rolle geht mit, damit
  // die Oberfläche Betrachter auf „nur ansehen“ stellen kann.
  const { doc, role } = await requireDoc(user.id, (await params).id, "view");
  return json({ doc: serializeDoc(doc), role });
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const input = await readBody(req, docUpdateSchema, { maxBytes: MAX_DOC_BYTES });
  // Baum verschieben, Anheften und Löschen bleiben beim Besitzer; Titel, Symbol
  // und Inhalt darf auch ein eingeladener Bearbeiter ändern.
  const needsOwner = input.parentId !== undefined || input.move !== undefined || input.pinned !== undefined;
  const { doc: current } = await requireDoc(user.id, id, needsOwner ? "own" : "edit");
  let structural = false;

  // Verschieben im Baum: bewusst ohne updatedAt – „Zuletzt bearbeitet“ soll
  // Inhalte meinen, nicht Aufräumen.
  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    if (input.parentId) {
      if (!(await findOwnDoc(user.id, input.parentId))) throw notFound(tk("docs", "errors.parentNotFound"));
      if (await wouldCreateCycle(user.id, id, input.parentId)) throw new ApiError(400, tk("docs", "errors.cycle"));
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

  // Live an andere offene Tabs/Geräte und an eingeladene Konten (#211). Nur bei
  // echter Inhaltsänderung; der sendende Tab (clientId) überspringt sein Echo.
  if (input.content !== undefined) publishDoc(id, { content: input.content, by: input.clientId ?? "" });

  return json({
    doc: serializeDoc(doc),
    item: serializeTreeItem(doc),
    // Der Baum gehört dem Besitzer; nur er verschiebt, also nur dann neu laden.
    tree: structural ? await loadTree(user.id) : undefined,
  });
});

// Löschen (mit Unterseiten per Cascade) ist dem Besitzer vorbehalten.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireDoc(user.id, id, "own");
  await db.doc.delete({ where: { id } });
  return json({ ok: true, tree: await loadTree(user.id) });
});
