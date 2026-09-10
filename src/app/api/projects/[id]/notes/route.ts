import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { findOwnProject } from "@/lib/projects";
import { noteCreateSchema } from "@/lib/validation";
import { NOTE_ORDER, noteLabel, serializeNote, touchProject } from "@/lib/notes";
import { logActivity } from "@/lib/activity";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await findOwnProject(user.id, id))) throw notFound("Projekt nicht gefunden");
  const notes = await db.note.findMany({ where: { projectId: id }, orderBy: NOTE_ORDER });
  return json({ notes: notes.map(serializeNote) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await findOwnProject(user.id, id))) throw notFound("Projekt nicht gefunden");
  const input = await readBody(req, noteCreateSchema);
  const note = await db.note.create({ data: { ...input, projectId: id } });
  await touchProject(id);
  await logActivity({ projectId: id, userId: user.id, kind: "NOTE_ADDED", summary: `Notiz „${noteLabel(note)}“ hinzugefügt` });
  return json({ note: serializeNote(note) }, { status: 201 });
});
