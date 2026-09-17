import { json, notFound, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireTeamPerm, requireTeams } from "@/lib/teams";
import { db } from "@/lib/db";
import { workflowSaveSchema } from "@/lib/aiWorkflowLogic";
import { saveTeamWorkflow, teamWorkflows } from "@/lib/aiWorkflows";

type Params = { teamId: string; key: string };

// Team-Workflow ändern oder löschen (#82) – nur mit „Team-Workflows verwalten“.

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, key } = await params;
  await requireTeamPerm(teamId, user.id, "team.workflows");
  const input = await readBody(req, workflowSaveSchema, { maxBytes: 32_000 });
  await saveTeamWorkflow(teamId, input, { key, authorName: displayNameOf(user), via: "web" });
  return json({ workflows: await teamWorkflows(teamId), canManage: true });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, key } = await params;
  await requireTeamPerm(teamId, user.id, "team.workflows");
  const { count } = await db.aiWorkflow.deleteMany({ where: { teamId, key } });
  if (!count) throw notFound("Workflow not found");
  return json({ workflows: await teamWorkflows(teamId), canManage: true });
});
