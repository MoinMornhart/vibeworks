import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeams, teamsOverview } from "@/lib/teams";
import { MAX_TEAM_NAME, MAX_TEAMS } from "@/lib/teamsLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const createSchema = z.object({ name: z.string().trim().min(1, tk("teams", "errors.nameEmpty")).max(MAX_TEAM_NAME, tk("teams", "errors.nameLong")) });

export const GET = route(async () => {
  const user = await requireApiUser();
  await requireTeams();
  return json({ overview: await teamsOverview(user.id) });
});

// Neues Team – wer es anlegt, ist sein erster Admin.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  await requireTeams();
  limitOrThrow(`team-create:${user.id}`, 10, 60 * MINUTE);
  const { name } = await readBody(req, createSchema, { maxBytes: 1024 });
  if ((await db.teamMember.count({ where: { userId: user.id } })) >= MAX_TEAMS) throw new ApiError(409, tk("teams", "errors.tooMany"));
  await db.team.create({ data: { name, createdById: user.id, members: { create: { userId: user.id, role: "ADMIN" } } } });
  return json({ overview: await teamsOverview(user.id) }, { status: 201 });
});
