import { db } from "@/lib/db";
import { displayNameOf } from "@/lib/auth/guard";
import { randomToken } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { availableRoles, canManageGrant, serializeRole, type Actor } from "@/lib/roles";
import { isSubset, LEGACY_ROLE_ID, permissionsOf } from "@/lib/rolesLogic";

// Teilen: öffentlicher Link (nur lesen, auch ohne Anmeldung), Mitglieder mit
// Rollen, Zugriffsanfragen und Freigaben an Teams. Link und Team-Freigaben
// verwaltet nur der Besitzer; wer „Mitglieder einladen“ darf, sieht Mitglieder
// und Anfragen und vergibt Rollen mit höchstens seinen eigenen Rechten.

export const newShareToken = () => randomToken(18);

const userSelect = { id: true, username: true, displayName: true } as const;
const roleRef = { select: { id: true, name: true, key: true, permissions: true } } as const;

/** Alles, was der Handelnde im Teilen-Dialog sieht. */
export async function shareState(projectId: string, actor: Actor) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { shareToken: true, ownerId: true } });
  const [members, requests, teams, myTeams, settings, roles] = await Promise.all([
    db.projectMember.findMany({ where: { projectId }, include: { user: { select: userSelect }, roleRef }, orderBy: { createdAt: "asc" } }),
    db.accessRequest.findMany({ where: { projectId, status: "PENDING" }, include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } }),
    actor.owner
      ? db.projectTeam.findMany({ where: { projectId }, include: { team: { select: { id: true, name: true, _count: { select: { members: true } } } }, roleRef }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    // Teilen geht nur mit Teams, in denen der Besitzer selbst ist
    actor.owner ? db.team.findMany({ where: { members: { some: { userId: project.ownerId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    getSettings(),
    availableRoles("project", project.ownerId),
  ]);
  const sharedIds = new Set(teams.map((t) => t.teamId));
  return {
    isOwner: actor.owner,
    shareToken: actor.owner ? project.shareToken : null,
    roles: roles.map((r) => ({ ...serializeRole(r, null), assignable: actor.owner || isSubset(r.permissions, actor.perms) })),
    members: members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      name: displayNameOf(m.user),
      // Ohne Rolle gilt die alte Stufe – sie entspricht genau der passenden Standardrolle
      roleId: m.roleId ?? LEGACY_ROLE_ID[m.role],
      since: m.createdAt.toISOString(),
      manageable: canManageGrant(actor, m.userId, permissionsOf([m])),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      name: displayNameOf(r.user),
      role: r.role,
      suggestedRoleId: LEGACY_ROLE_ID[r.role],
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    teamsEnabled: actor.owner && settings.mode === "MULTI",
    teams: teams.map((t) => ({ teamId: t.teamId, name: t.team.name, roleId: t.roleId ?? LEGACY_ROLE_ID[t.role], members: t.team._count.members })),
    myTeams: myTeams.filter((t) => !sharedIds.has(t.id)),
  };
}
export type ShareState = Awaited<ReturnType<typeof shareState>>;
