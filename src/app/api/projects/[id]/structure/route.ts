import { json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { structureInputSchema } from "@/lib/projectStructureLogic";
import { saveStructure, structureView } from "@/lib/projectStructure";
import { logActivity } from "@/lib/activity";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Projektaufbau (#101): lesen darf, wer das Projekt sieht; ändern wie Notizen.

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`structure:${user.id}`, 60, MINUTE);
  return json({ structure: await structureView(project.id) });
});

export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "notes.edit");
  const input = await readBody(req, structureInputSchema, { maxBytes: 128_000 });
  const structure = await saveStructure(project.id, input, displayNameOf(user));
  await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary: "Projektaufbau aktualisiert", meta: { fields: ["structure"] } });
  return json({ structure });
});
