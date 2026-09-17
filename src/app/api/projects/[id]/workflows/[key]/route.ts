import { json, notFound, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { db } from "@/lib/db";
import { workflowSaveSchema } from "@/lib/aiWorkflowLogic";
import { saveWorkflow, workflowPayload } from "@/lib/aiWorkflows";

type Params = { id: string; key: string };

// Eigenen KI-Workflow ändern oder löschen (#101) – mitgelieferte bleiben, wie sie sind.

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id, key } = await params;
  const { project } = await requireProject(user.id, id, "workflows.manage");
  const input = await readBody(req, workflowSaveSchema, { maxBytes: 32_000 });
  await saveWorkflow(project.id, input, { key, authorName: displayNameOf(user), via: "web" });
  return json(await workflowPayload(project.id));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, key } = await params;
  const { project } = await requireProject(user.id, id, "workflows.manage");
  const { count } = await db.aiWorkflow.deleteMany({ where: { projectId: project.id, key } });
  if (!count) throw notFound("Workflow not found");
  return json(await workflowPayload(project.id));
});
