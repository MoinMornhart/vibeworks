import { db } from "./db";
import { ApiError, notFound } from "./api";
import { getSettings } from "./settings";
import { tk } from "./i18n/messages";
import { displayNameOf } from "./auth/guard";
import { appLink, notifyUser } from "./notify";
import type { TeamRole } from "./teamsLogic";

// Teams: Konten, mit denen man Projekte auf einmal teilt. Beitritt nur per
// Einladung, die das Konto annehmen muss. Mitglieder, Einladungen und
// Team-Projekte sehen nur Mitglieder; Mitglieder und Einladungen verwalten
// die Team-Admins. Nur im Mehrbenutzerbetrieb.

export async function teamsOn(): Promise<boolean> {
  return (await getSettings()).mode === "MULTI";
}

export async function requireTeams(): Promise<void> {
  if (!(await teamsOn())) throw notFound(tk("teams", "errors.off"));
}

/** Mitgliedschaft – Fremde bekommen 404, ob es das Team gibt, verrät die API nicht. */
export async function requireTeamMember(teamId: string, userId: string) {
  const member = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  if (!member) throw notFound(tk("teams", "errors.notFound"));
  return member;
}

export async function requireTeamAdmin(teamId: string, userId: string) {
  const member = await requireTeamMember(teamId, userId);
  if (member.role !== "ADMIN") throw new ApiError(403, tk("teams", "errors.adminOnly"));
  return member;
}

const userSelect = { select: { id: true, username: true, displayName: true } } as const;

export async function teamsOverview(userId: string) {
  const [teams, invites] = await Promise.all([
    db.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: "asc" },
      include: {
        members: { include: { user: userSelect }, orderBy: { createdAt: "asc" } },
        invites: { include: { user: userSelect }, orderBy: { createdAt: "asc" } },
        projects: { include: { project: { select: { id: true, name: true, owner: userSelect } } }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.teamInvite.findMany({ where: { userId }, include: { team: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const inviterIds = invites.map((i) => i.invitedById).filter((x): x is string => Boolean(x));
  const inviters = inviterIds.length ? await db.user.findMany({ where: { id: { in: inviterIds } }, select: userSelect.select }) : [];
  const inviterName = new Map(inviters.map((u) => [u.id, displayNameOf(u)]));

  return {
    teams: teams.map((t) => {
      const myRole = (t.members.find((m) => m.userId === userId)?.role ?? "MEMBER") as TeamRole;
      return {
        id: t.id,
        name: t.name,
        myRole,
        members: t.members.map((m) => ({ userId: m.userId, name: displayNameOf(m.user), username: m.user.username, role: m.role as TeamRole, since: m.createdAt.toISOString() })),
        // Offene Einladungen sehen nur Admins
        invites: myRole === "ADMIN" ? t.invites.map((i) => ({ userId: i.userId, name: displayNameOf(i.user), username: i.user.username, since: i.createdAt.toISOString() })) : [],
        projects: t.projects.map((p) => ({ id: p.project.id, name: p.project.name, owner: displayNameOf(p.project.owner), role: p.role })),
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
