import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { requireTeams } from "@/lib/teams";
import { logActivity } from "@/lib/activity";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const bodySchema = z.object({ teamId: z.string().min(1).max(40), role: z.enum(["VIEWER", "EDITOR"]) });

// Projekt an ein Team freigeben – nur der Besitzer, und nur an Teams, in denen er selbst ist.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  limitOrThrow(`project-team:${user.id}`, 30, 10 * MINUTE);
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const { teamId, role } = await readBody(req, bodySchema, { maxBytes: 512 });
  const team = await db.team.findFirst({ where: { id: teamId, members: { some: { userId: user.id } } }, select: { id: true, name: true } });
  if (!team) throw new ApiError(404, tk("share", "errors.notInTeam"));
  await db.projectTeam.upsert({ where: { projectId_teamId: { projectId: project.id, teamId } }, create: { projectId: project.id, teamId, role }, update: { role } });
  await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary: `Mit Team „${team.name}“ geteilt`, meta: { action: "teamShare", team: team.name } });
  return json({ share: await shareState(project.id) }, { status: 201 });
});
