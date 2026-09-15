import { db } from "./db";
import { ApiError, notFound } from "./api";
import { getSettings } from "./settings";
import { tk } from "./i18n/messages";
import { displayNameOf } from "./auth/guard";
import { appLink, notifyUser } from "./notify";
import { sortRoles } from "./roles";
import { isSubset, LEGACY_TEAM_ROLE_ID, teamPermissionsOf, type TeamPermission } from "./rolesLogic";

// Teams: Konten, mit denen man Projekte auf einmal teilt. Beitritt nur per
// Einladung, die das Konto annehmen muss. Was ein Mitglied im Team darf,
// bestimmt seine Team-Rolle (einladen, entfernen, Rollen vergeben, Team
// verwalten). Mitglieder, Einladungen und Team-Projekte sehen nur Mitglieder.
// Nur im Mehrbenutzerbetrieb.

export async function teamsOn(): Promise<boolean> {
  return (await getSettings()).mode === "MULTI";
}

export async function requireTeams(): Promise<void> {
  if (!(await teamsOn())) throw notFound(tk("teams", "errors.off"));
}

const roleRef = { select: { id: true, name: true, key: true, permissions: true, ownerId: true } } as const;

/** Mitgliedschaft samt Team-Rechten – Fremde bekommen 404, ob es das Team gibt, verrät die API nicht. */
export async function requireTeamMember(teamId: string, userId: string) {
  const member = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, include: { roleRef } });
  if (!member) throw notFound(tk("teams", "errors.notFound"));
  return { member, perms: teamPermissionsOf(member) };
}

export async function requireTeamPerm(teamId: string, userId: string, perm: TeamPermission) {
  const res = await requireTeamMember(teamId, userId);
  if (!res.perms.has(perm)) throw new ApiError(403, tk("teams", "errors.adminOnly"));
  return res;
}

/** Alle Mitglieder mit ihren Rechten – für die Prüfungen „bleibt jemand, der verwalten darf?“ */
export async function teamMembersWithPerms(teamId: string) {
  const rows = await db.teamMember.findMany({ where: { teamId }, include: { roleRef } });
  return rows.map((m) => ({ userId: m.userId, roleId: m.roleId, perms: teamPermissionsOf(m), manager: teamPermissionsOf(m).has("team.manage") }));
}

/**
 * Bleibt jemand, der das Team verwalten darf, wenn die Rolle roleId künftig
 * diese Rechte hat (null: die Rolle wird gelöscht – ihre Mitglieder dürfen nichts mehr)?
 */
export async function keepsManager(teamId: string, roleId: string, nextPermissions: string[] | null): Promise<boolean> {
  const members = await teamMembersWithPerms(teamId);
  return members.some((m) => (m.roleId === roleId ? Boolean(nextPermissions?.includes("team.manage")) : m.manager));
}

/** Team-Rolle für eine Vergabe: Standard, Vorlage oder eine eigene Rolle dieses Teams. */
export async function assignableTeamRole(roleId: string, teamId: string) {
  const role = await db.role.findFirst({ where: { id: roleId, scope: "team", OR: [{ ownerId: null, teamId: null }, { teamId }] } });
  if (!role) throw new ApiError(400, tk("roles", "errors.unknownRole"));
  return role;
}

const userSelect = { select: { id: true, username: true, displayName: true } } as const;

export async function teamsOverview(userId: string) {
  const [teams, invites, templates] = await Promise.all([
    db.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: "asc" },
      include: {
        members: { include: { user: userSelect, roleRef }, orderBy: { createdAt: "asc" } },
        invites: { include: { user: userSelect }, orderBy: { createdAt: "asc" } },
        projects: { include: { project: { select: { id: true, name: true, owner: userSelect } }, roleRef }, orderBy: { createdAt: "asc" } },
        roles: true,
      },
    }),
    db.teamInvite.findMany({ where: { userId }, include: { team: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.role.findMany({ where: { scope: "team", ownerId: null, teamId: null } }),
  ]);
  const inviterIds = invites.map((i) => i.invitedById).filter((x): x is string => Boolean(x));
  const inviters = inviterIds.length ? await db.user.findMany({ where: { id: { in: inviterIds } }, select: userSelect.select }) : [];
  const inviterName = new Map(inviters.map((u) => [u.id, displayNameOf(u)]));

  return {
    teams: teams.map((t) => {
      // Standard, Vorlagen und die eigenen Rollen des Teams
      const roles = sortRoles([...templates, ...t.roles]);
      const me = t.members.find((m) => m.userId === userId);
      const myPerms = me ? teamPermissionsOf(me) : new Set<TeamPermission>();
      const can = { invite: myPerms.has("team.invite"), remove: myPerms.has("team.remove"), roles: myPerms.has("team.roles"), manage: myPerms.has("team.manage") };
      return {
        id: t.id,
        name: t.name,
        myRole: me?.roleRef ? { name: me.roleRef.name, key: me.roleRef.key } : null,
        can,
        roles: roles.map((r) => ({ id: r.id, name: r.name, key: r.key, permissions: r.permissions })),
        /** Rollen, die ich hier vergeben darf: höchstens meine eigenen Rechte */
        assignable: roles.filter((r) => isSubset(r.permissions, myPerms)).map((r) => r.id),
        members: t.members.map((m) => {
          const perms = teamPermissionsOf(m);
          return {
            userId: m.userId,
            name: displayNameOf(m.user),
            username: m.user.username,
            roleId: m.roleId ?? LEGACY_TEAM_ROLE_ID[m.role === "ADMIN" ? "ADMIN" : "MEMBER"],
            role: m.roleRef ? { name: m.roleRef.name, key: m.roleRef.key } : null,
            manager: perms.has("team.manage"),
            since: m.createdAt.toISOString(),
            // Andere, die nicht mehr dürfen als ich
            manageable: m.userId !== userId && isSubset(perms, myPerms),
          };
        }),
        // Offene Einladungen sehen, wer einladen darf
        invites: can.invite ? t.invites.map((i) => ({ userId: i.userId, name: displayNameOf(i.user), username: i.user.username, since: i.createdAt.toISOString() })) : [],
        projects: t.projects.map((p) => ({
          id: p.project.id,
          name: p.project.name,
          owner: displayNameOf(p.project.owner),
          role: p.roleRef ? { name: p.roleRef.name, key: p.roleRef.key } : null,
        })),
      };
    }),
    invites: invites.map((i) => ({ id: i.id, teamId: i.team.id, team: i.team.name, from: i.invitedById ? (inviterName.get(i.invitedById) ?? null) : null, since: i.createdAt.toISOString() })),
  };
}
export type TeamsOverview = Awaited<ReturnType<typeof teamsOverview>>;

export async function notifyTeamInvite(userId: string, team: string, from: string): Promise<void> {
  await notifyUser(userId, "team", (t) => ({
    event: "team",
    title: t("events.team.title", { team }),
    message: t("events.team.message", { name: from, team }),
    url: appLink("/teams"),
  })).catch((err) => console.error("[teams]", err));
}
