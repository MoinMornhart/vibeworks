import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { shareState } from "@/lib/share";
import { requireTeams } from "@/lib/teams";
import { actorOf, assignableProjectRole } from "@/lib/roles";
import { LEGACY_ROLE_ID } from "@/lib/rolesLogic";
import { logActivity } from "@/lib/activity";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const bodySchema = z.object({ teamId: z.string().min(1).max(40), roleId: z.string().min(1).max(40).optional(), role: z.enum(["VIEWER", "EDITOR"]).optional() });

// Projekt an ein Team freigeben – nur der Besitzer, und nur an Teams, in denen er selbst ist.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  limitOrThrow(`project-team:${user.id}`, 30, 10 * MINUTE);
  const res = await requireProject(user.id, (await params).id, "OWNER");
  const { project } = res;
  const { teamId, roleId, role } = await readBody(req, bodySchema, { maxBytes: 512 });
  const team = await db.team.findFirst({ where: { id: teamId, members: { some: { userId: user.id } } }, select: { id: true, name: true } });
  if (!team) throw new ApiError(404, tk("share", "errors.notInTeam"));
  const chosen = await assignableProjectRole(roleId ?? LEGACY_ROLE_ID[role ?? "VIEWER"], project.ownerId);
  await db.projectTeam.upsert({
    where: { projectId_teamId: { projectId: project.id, teamId } },
    create: { projectId: project.id, teamId, role: "VIEWER", roleId: chosen.id },
    update: { role: "VIEWER", roleId: chosen.id },
  });
  await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary: `Mit Team „${team.name}“ geteilt (${chosen.name})`, meta: { action: "teamShare", team: team.name, role: chosen.name } });
  return json({ share: await shareState(project.id, actorOf(res, user.id)) }, { status: 201 });
});
