import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeamPerm, requireTeams, teamsOverview } from "@/lib/teams";
import { MAX_TEAM_NAME } from "@/lib/teamsLogic";
import { tk } from "@/lib/i18n/messages";

type Params = { teamId: string };

const renameSchema = z.object({ name: z.string().trim().min(1, tk("teams", "errors.nameEmpty")).max(MAX_TEAM_NAME, tk("teams", "errors.nameLong")) });

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamPerm(teamId, user.id, "team.manage");
  const { name } = await readBody(req, renameSchema, { maxBytes: 1024 });
  await db.team.update({ where: { id: teamId }, data: { name } });
  return json({ overview: await teamsOverview(user.id) });
});

// Team löschen – alle Freigaben an das Team enden damit.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamPerm(teamId, user.id, "team.manage");
  await db.team.delete({ where: { id: teamId } });
  return json({ overview: await teamsOverview(user.id) });
});
