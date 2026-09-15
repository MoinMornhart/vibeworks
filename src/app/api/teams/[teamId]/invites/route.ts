import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { notifyTeamInvite, requireTeamAdmin, requireTeams, teamsOverview } from "@/lib/teams";
import { usernameSchema } from "@/lib/validation";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { teamId: string };

const inviteSchema = z.object({ username: usernameSchema });
const revokeSchema = z.object({ userId: z.string().min(1).max(40) });

// Konto einladen – es wird erst Mitglied, wenn es annimmt. Nur Team-Admins.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamAdmin(teamId, user.id);
  limitOrThrow(`team-invite:${user.id}`, 30, 10 * MINUTE);
  const { username } = await readBody(req, inviteSchema, { maxBytes: 512 });
  const target = await db.user.findFirst({ where: { username, active: true }, select: { id: true } });
  if (!target) throw new ApiError(404, tk("teams", "errors.noAccount"), { username: tk("share", "errors.unknown") });
  if (await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: target.id } } })) throw new ApiError(409, tk("teams", "errors.alreadyMember"));
  if (await db.teamInvite.findUnique({ where: { teamId_userId: { teamId, userId: target.id } } })) throw new ApiError(409, tk("teams", "errors.alreadyInvited"));
  const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });
  await db.teamInvite.create({ data: { teamId, userId: target.id, invitedById: user.id } });
  void notifyTeamInvite(target.id, team.name, displayNameOf(user));
  return json({ overview: await teamsOverview(user.id) }, { status: 201 });
});

export const DELETE = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamAdmin(teamId, user.id);
  const { userId } = await readBody(req, revokeSchema, { maxBytes: 512 });
  await db.teamInvite.deleteMany({ where: { teamId, userId } });
  return json({ overview: await teamsOverview(user.id) });
});
