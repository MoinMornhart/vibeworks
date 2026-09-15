import { z } from "zod";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeams, teamsOverview } from "@/lib/teams";
import { tk } from "@/lib/i18n/messages";

type Params = { inviteId: string };

const bodySchema = z.object({ action: z.enum(["accept", "decline"]) });

// Einladung annehmen oder ablehnen – nur das eingeladene Konto selbst.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const invite = await db.teamInvite.findFirst({ where: { id: (await params).inviteId, userId: user.id } });
  if (!invite) throw notFound(tk("teams", "errors.inviteNotFound"));
  const { action } = await readBody(req, bodySchema, { maxBytes: 256 });
  if (action === "accept") {
    await db.$transaction([
      db.teamMember.upsert({ where: { teamId_userId: { teamId: invite.teamId, userId: user.id } }, create: { teamId: invite.teamId, userId: user.id, role: "MEMBER", roleId: "role-team-member" }, update: {} }),
      db.teamInvite.delete({ where: { id: invite.id } }),
    ]);
  } else {
    await db.teamInvite.delete({ where: { id: invite.id } });
  }
  return json({ overview: await teamsOverview(user.id) });
});
