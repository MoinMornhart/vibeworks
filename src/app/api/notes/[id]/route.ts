import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireNote } from "@/lib/access";
import { noteUpdateSchema } from "@/lib/validation";
import { noteLabel, serializeNote, touchProject } from "@/lib/notes";
import { logActivity } from "@/lib/activity";

type Params = { id: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { note: current } = await requireNote(user.id, id, "EDITOR");
  const input = await readBody(req, noteUpdateSchema);

  const contentChanged =
    (input.content !== undefined && input.content !== current.content) ||
    (input.title !== undefined && input.title !== current.title);

  if (!contentChanged) {
    // Nur Anpinnen: Änderungsdatum bleibt, sonst stünde „bearbeitet“ an einer
    // Notiz, deren Text niemand angefasst hat.
    if (input.pinned !== undefined && input.pinned !== current.pinned) {
      await db.$executeRaw`UPDATE "Note" SET "pinned" = ${input.pinned} WHERE "id" = ${id}`;
    }
    const note = await db.note.findUniqueOrThrow({ where: { id } });
    return json({ note: serializeNote(note) });
  }

  const note = await db.note.update({
    where: { id },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    },
  });
  await touchProject(note.projectId);
  await logActivity({ projectId: note.projectId, userId: user.id, kind: "NOTE_UPDATED", summary: `Notiz „${noteLabel(note)}“ bearbeitet` });
  return json({ note: serializeNote(note) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { note } = await requireNote(user.id, id, "EDITOR");
  await db.note.delete({ where: { id } });
  await logActivity({ projectId: note.projectId, userId: user.id, kind: "NOTE_DELETED", summary: `Notiz „${noteLabel(note)}“ gelöscht` });
  return json({ ok: true });
});
