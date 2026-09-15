import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeamMember, requireTeams } from "@/lib/teams";
import { teamMessages } from "@/lib/teamHub";
import { MAX_TEAM_MESSAGE } from "@/lib/teamHubLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { teamId: string };

const bodySchema = z.object({
  body: z.string().trim().min(1, tk("teamHub", "errors.empty")).max(MAX_TEAM_MESSAGE, tk("teamHub", "errors.tooLong")),
});

// Team-Chat: nur Mitglieder lesen und schreiben; die Seite fragt alle paar Sekunden nach.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamMember(teamId, user.id);
  return json({ messages: await teamMessages(teamId) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamMember(teamId, user.id);
  limitOrThrow(`team-chat:${user.id}`, 20, MINUTE);
  const { body } = await readBody(req, bodySchema, { maxBytes: MAX_TEAM_MESSAGE * 4 });
  await db.teamMessage.create({ data: { teamId, authorId: user.id, body } });
  return json({ messages: await teamMessages(teamId) }, { status: 201 });
});
