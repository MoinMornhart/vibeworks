import { json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireTeamMember, requireTeamPerm, requireTeams } from "@/lib/teams";
import { workflowSaveSchema } from "@/lib/aiWorkflowLogic";
import { saveTeamWorkflow, teamWorkflows } from "@/lib/aiWorkflows";

type Params = { teamId: string };

// Team-Workflows (#82): sehen alle Mitglieder, anlegen mit „Team-Workflows verwalten“.
// Sie gelten in allen Projekten, die an das Team freigegeben sind.

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  const { perms } = await requireTeamMember(teamId, user.id);
  return json({ workflows: await teamWorkflows(teamId), canManage: perms.has("team.workflows") });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamPerm(teamId, user.id, "team.workflows");
  const input = await readBody(req, workflowSaveSchema, { maxBytes: 32_000 });
  const saved = await saveTeamWorkflow(teamId, input, { authorName: displayNameOf(user), via: "web" });
  return json({ key: saved.key, workflows: await teamWorkflows(teamId), canManage: true }, { status: 201 });
});
