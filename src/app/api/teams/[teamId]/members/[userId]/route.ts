import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { assignableTeamRole, requireTeamMember, requireTeamPerm, requireTeams, teamMembersWithPerms, teamsOverview } from "@/lib/teams";
import { leaveOutcome } from "@/lib/teamsLogic";
import { isSubset, LEGACY_TEAM_ROLE_ID, teamPermissionsOf } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";

type Params = { teamId: string; userId: string };

const roleSchema = z.object({ roleId: z.string().min(1).max(40).optional(), role: z.enum(["ADMIN", "MEMBER"]).optional() });

const aboveYou = () => new ApiError(403, tk("roles", "errors.aboveYou"));

// Team-Rolle vergeben – mit dem Recht „Rollen vergeben“: nur Rollen bis zu den
// eigenen Rechten, nicht an wen, der mehr darf; das Team behält immer jemanden,
// der es verwalten darf.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, userId: raw } = await params;
  const userId = raw === "me" ? user.id : raw;
  const { perms: myPerms } = await requireTeamPerm(teamId, user.id, "team.roles");
  const { roleId, role } = await readBody(req, roleSchema, { maxBytes: 256 });
  const members = await teamMembersWithPerms(teamId);
  const target = members.find((m) => m.userId === userId);
  if (!target) throw notFound(tk("teams", "errors.memberNotFound"));
  if (userId !== user.id && !isSubset(target.perms, myPerms)) throw aboveYou();
  const chosen = await assignableTeamRole(roleId ?? LEGACY_TEAM_ROLE_ID[role ?? "MEMBER"], teamId);
  if (!isSubset(chosen.permissions, myPerms)) throw aboveYou();
  const after = members.map((m) => (m.userId === userId ? { ...m, manager: teamPermissionsOf({ role: "MEMBER", roleRef: chosen }).has("team.manage") } : m));
  if (!after.some((m) => m.manager)) throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  await db.teamMember.update({ where: { teamId_userId: { teamId, userId } }, data: { role: "MEMBER", roleId: chosen.id } });
  return json({ overview: await teamsOverview(user.id) });
});

// Entfernen (Recht „Mitglieder entfernen“, nur wer nicht mehr darf) oder selbst gehen.
// Der Zugriff auf die Team-Projekte endet sofort.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  const { teamId, userId: raw } = await params;
  const self = raw === user.id || raw === "me";
  const target = self ? user.id : raw;
  if (self) await requireTeamMember(teamId, user.id);
  const members = await teamMembersWithPerms(teamId);
  const victim = members.find((m) => m.userId === target);
  if (!self) {
    const { perms: myPerms } = await requireTeamPerm(teamId, user.id, "team.remove");
    if (!victim) throw notFound(tk("teams", "errors.memberNotFound"));
    if (!isSubset(victim.perms, myPerms)) throw aboveYou();
  }
  if (!victim) throw notFound(tk("teams", "errors.memberNotFound"));
  const outcome = leaveOutcome(members, target);
  if (outcome === "lastAdmin") throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  if (outcome === "lastMember") await db.team.delete({ where: { id: teamId } }); // leeres Team verschwindet samt Freigaben
  else await db.teamMember.delete({ where: { teamId_userId: { teamId, userId: target } } });
  return json({ overview: await teamsOverview(user.id) });
});
