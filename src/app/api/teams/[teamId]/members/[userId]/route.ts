import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeamAdmin, requireTeamMember, requireTeams, teamsOverview } from "@/lib/teams";
import { canDemote, leaveOutcome, TEAM_ROLES } from "@/lib/teamsLogic";
import { tk } from "@/lib/i18n/messages";

type Params = { teamId: string; userId: string };

const roleSchema = z.object({ role: z.enum(TEAM_ROLES) });

// Rolle ändern – nur Team-Admins, und das Team behält immer mindestens einen Admin.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, userId } = await params;
  await requireTeamAdmin(teamId, user.id);
  const { role } = await readBody(req, roleSchema, { maxBytes: 256 });
  const members = await db.teamMember.findMany({ where: { teamId }, select: { userId: true, role: true } });
  if (!members.some((m) => m.userId === userId)) throw notFound(tk("teams", "errors.memberNotFound"));
  if (role === "MEMBER" && !canDemote(members, userId)) throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  await db.teamMember.update({ where: { teamId_userId: { teamId, userId } }, data: { role } });
  return json({ overview: await teamsOverview(user.id) });
});

// Entfernen (Admin) oder selbst gehen. Der Zugriff auf die Team-Projekte endet sofort.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, userId } = await params;
  const self = userId === user.id || userId === "me";
  const target = self ? user.id : userId;
  if (self) await requireTeamMember(teamId, user.id);
  else await requireTeamAdmin(teamId, user.id);
  const members = await db.teamMember.findMany({ where: { teamId }, select: { userId: true, role: true } });
  if (!members.some((m) => m.userId === target)) throw notFound(tk("teams", "errors.memberNotFound"));
  const outcome = leaveOutcome(members, target);
  if (outcome === "lastAdmin") throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  if (outcome === "lastMember") await db.team.delete({ where: { id: teamId } }); // leeres Team verschwindet samt Freigaben
  else await db.teamMember.delete({ where: { teamId_userId: { teamId, userId: target } } });
  return json({ overview: await teamsOverview(user.id) });
});
