import { json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { workflowSaveSchema } from "@/lib/aiWorkflowLogic";
import { saveWorkflow, workflowPayload } from "@/lib/aiWorkflows";

type Params = { id: string };

// KI-Workflows eines Projekts (#101): ansehen ab Betrachter, eigene anlegen mit „Projektangaben ändern“.

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json(await workflowPayload(project.id));
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "project.edit");
  const input = await readBody(req, workflowSaveSchema, { maxBytes: 32_000 });
  const saved = await saveWorkflow(project.id, input, { authorName: displayNameOf(user), via: "web" });
  return json({ key: saved.key, ...(await workflowPayload(project.id)) }, { status: 201 });
});
