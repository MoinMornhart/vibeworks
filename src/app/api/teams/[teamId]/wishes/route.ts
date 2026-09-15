import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireTeamMember, requireTeams, teamMembersWithPerms } from "@/lib/teams";
import { teamHub } from "@/lib/teamHub";
import { MAX_WISH_BODY, MAX_WISH_TITLE, WISH_LIMIT, WISH_WINDOW_MS } from "@/lib/teamHubLogic";
import { appLink, notifyUser } from "@/lib/notify";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { teamId: string };

const schema = z.object({
  title: z.string().trim().min(3, tk("teamHub", "errors.empty")).max(MAX_WISH_TITLE, tk("teamHub", "errors.tooLong")),
  body: z.string().trim().max(MAX_WISH_BODY, tk("teamHub", "errors.tooLong")).nullish(),
});

// Wunsch ans Team einreichen: jedes Mitglied höchstens 3 in 24 Stunden.
// Wer das Team verwaltet, bekommt eine Meldung und entscheidet.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId } = await params;
  await requireTeamMember(teamId, user.id);
  limitOrThrow(`team-wish:${user.id}`, 10, 10 * MINUTE);
  const input = await readBody(req, schema, { maxBytes: MAX_WISH_BODY * 4 });
  const used = await db.teamWish.count({ where: { teamId, authorId: user.id, createdAt: { gte: new Date(Date.now() - WISH_WINDOW_MS) } } });
  if (used >= WISH_LIMIT) throw new ApiError(409, tk("teamHub", "errors.wishLimit", { n: WISH_LIMIT }));
  await db.teamWish.create({ data: { teamId, authorId: user.id, title: input.title, body: input.body || null } });

  const [team, members] = await Promise.all([db.team.findUnique({ where: { id: teamId }, select: { name: true } }), teamMembersWithPerms(teamId)]);
  const name = displayNameOf(user);
  after(() =>
    Promise.all(
      members
        .filter((m) => m.manager && m.userId !== user.id)
        .map((m) =>
          notifyUser(m.userId, "team", (t) => ({
            event: "team",
            title: t("events.wish.newTitle", { team: team?.name ?? "" }),
            message: t("events.wish.newMessage", { name, title: input.title }),
            url: appLink(`/teams/${teamId}`),
          })),
        ),
    ),
  );
  return json({ hub: await teamHub(teamId, user.id) }, { status: 201 });
});
