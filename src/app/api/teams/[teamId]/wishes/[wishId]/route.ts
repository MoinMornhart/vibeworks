import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { createTask } from "@/lib/actions";
import { requireTeamPerm, requireTeams } from "@/lib/teams";
import { teamHub } from "@/lib/teamHub";
import { appLink, notifyUser } from "@/lib/notify";
import { tk } from "@/lib/i18n/messages";

type Params = { teamId: string; wishId: string };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), projectId: z.string().min(1).max(40) }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().max(300).nullish() }),
]);

// Über einen Wunsch entscheiden – nur wer das Team verwaltet. Annehmen legt
// eine Aufgabe in einem Team-Projekt an, in dem man Aufgaben anlegen darf.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, wishId } = await params;
  await requireTeamPerm(teamId, user.id, "team.manage");
  const input = await readBody(req, schema, { maxBytes: 1024 });
  const wish = await db.teamWish.findFirst({ where: { id: wishId, teamId }, include: { author: { select: { id: true, username: true, displayName: true } } } });
  if (!wish) throw notFound(tk("teamHub", "errors.wishNotFound"));
  if (wish.status !== "open") throw new ApiError(409, tk("teamHub", "errors.wishDone"));
  const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });

  if (input.action === "accept") {
    const shared = await db.projectTeam.findFirst({ where: { projectId: input.projectId, teamId }, select: { projectId: true } });
    if (!shared) throw new ApiError(400, tk("teamHub", "errors.notTeamProject"));
    await requireProject(user.id, input.projectId, "tasks.edit");
    // Erst reservieren – so entsteht auch bei zwei gleichzeitigen Klicks nur eine Aufgabe
    const { count } = await db.teamWish.updateMany({ where: { id: wish.id, status: "open" }, data: { status: "accepted", decidedById: user.id, decidedAt: new Date(), projectId: input.projectId } });
    if (!count) throw new ApiError(409, tk("teamHub", "errors.wishDone"));
    try {
      const { task } = await createTask(user.id, input.projectId, {
        title: wish.title.slice(0, 200),
        description: `${wish.body ? `${wish.body}\n\n` : ""}---\nWunsch von ${displayNameOf(wish.author)} im Team „${team.name}“`,
        status: "TODO",
        dueDate: null,
        labels: ["wunsch"],
        recurrence: null,
      });
      await db.teamWish.update({ where: { id: wish.id }, data: { taskId: task.id } });
    } catch (err) {
      await db.teamWish.update({ where: { id: wish.id }, data: { status: "open", decidedById: null, decidedAt: null, projectId: null } });
      throw err;
    }
    if (wish.authorId !== user.id) {
      after(() =>
        notifyUser(wish.authorId, "team", (t) => ({
          event: "team",
          title: t("events.wish.acceptedTitle", { title: wish.title }),
          message: t("events.wish.acceptedMessage", { team: team.name }),
          url: appLink(`/projects/${input.projectId}`),
        })),
      );
    }
  } else {
    const reason = input.reason || null;
    const { count } = await db.teamWish.updateMany({ where: { id: wish.id, status: "open" }, data: { status: "declined", decidedById: user.id, decidedAt: new Date(), reason } });
    if (!count) throw new ApiError(409, tk("teamHub", "errors.wishDone"));
    if (wish.authorId !== user.id) {
      after(() =>
        notifyUser(wish.authorId, "team", (t) => ({
          event: "team",
          title: t("events.wish.declinedTitle", { title: wish.title }),
          message: t("events.wish.declinedMessage", { team: team.name, reason: reason ? ` ${reason}` : "" }),
          url: appLink(`/teams/${teamId}`),
        })),
      );
    }
  }
  return json({ hub: await teamHub(teamId, user.id) });
});
