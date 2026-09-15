import { db } from "@/lib/db";
import { displayNameOf } from "@/lib/auth/guard";
import { randomToken } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";

// Teilen: öffentlicher Link (nur lesen, auch ohne Anmeldung), Mitglieder mit
// Rollen, Zugriffsanfragen, über die der Besitzer entscheidet, und Freigaben
// an Teams (alle Mitglieder bekommen die Rolle).

export const newShareToken = () => randomToken(18);

const userSelect = { id: true, username: true, displayName: true } as const;

/** Alles, was der Besitzer im Teilen-Dialog sieht. */
export async function shareState(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { shareToken: true, ownerId: true } });
  const [members, requests, teams, myTeams, settings] = await Promise.all([
    db.projectMember.findMany({ where: { projectId }, include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } }),
    db.accessRequest.findMany({ where: { projectId, status: "PENDING" }, include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } }),
    db.projectTeam.findMany({ where: { projectId }, include: { team: { select: { id: true, name: true, _count: { select: { members: true } } } } }, orderBy: { createdAt: "asc" } }),
    // Teilen geht nur mit Teams, in denen der Besitzer selbst ist
    db.team.findMany({ where: { members: { some: { userId: project.ownerId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  const sharedIds = new Set(teams.map((t) => t.teamId));
  return {
    shareToken: project.shareToken,
    members: members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      name: displayNameOf(m.user),
      role: m.role,
      since: m.createdAt.toISOString(),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      name: displayNameOf(r.user),
      role: r.role,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    teamsEnabled: settings.mode === "MULTI",
    teams: teams.map((t) => ({ teamId: t.teamId, name: t.team.name, role: t.role, members: t.team._count.members })),
    myTeams: myTeams.filter((t) => !sharedIds.has(t.id)),
  };
}
export type ShareState = Awaited<ReturnType<typeof shareState>>;
