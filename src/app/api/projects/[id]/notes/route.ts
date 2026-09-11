import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { noteCreateSchema } from "@/lib/validation";
import { NOTE_ORDER, noteLabel, serializeNote, touchProject } from "@/lib/notes";
import { logActivity } from "@/lib/activity";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id);
  const notes =await db.note.findMany({ where: { projectId: id }, orderBy: NOTE_ORDER });
  return json({ notes: notes.map(serializeNote) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id, "EDITOR");
  const input =await readBody(req, noteCreateSchema);
  const note = await db.note.create({ data: { ...input, projectId: id } });
  await touchProject(id);
  await logActivity({ projectId: id, userId: user.id, kind: "NOTE_ADDED", summary: `Notiz „${noteLabel(note)}“ hinzugefügt`, meta: { title: noteLabel(note) } });
  return json({ note: serializeNote(note) }, { status: 201 });
});
