import { db } from "./db";
import { notFound } from "./api";
import { tk } from "./i18n/messages";
import { displayNameOf } from "./auth/guard";
import { accessOf, canDo } from "./access";
import { requireTeamMember } from "./teams";
import { isClaude, sortByProgress, wishesLeft, WISH_WINDOW_MS, type WishStatus } from "./teamHubLogic";

// Team-Seite (#38): Übersicht für alle im Team – Mitglieder, Team-Projekte mit
// offenen Aufgaben und Fehlern, woran Claude gerade arbeitet, letzte
// Aktivität, Wünsche und Chat. Sichtbar nur für Mitglieder; es erscheint nur,
// was das Team über seine Freigaben ohnehin sehen darf. MCP-Aufrufe anderer
// Konten zeigt die Seite bewusst nicht.

const userSelect = { select: { id: true, username: true, displayName: true } } as const;

export async function teamHub(teamId: string, userId: string) {
  const { perms } = await requireTeamMember(teamId, userId);
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: { include: { user: userSelect, roleRef: { select: { name: true, key: true } } }, orderBy: { createdAt: "asc" } },
      projects: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              _count: { select: { tasks: { where: { status: { not: "DONE" } } }, appErrors: { where: { status: "open" } } } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!team) throw notFound(tk("teams", "errors.notFound"));
  const projectIds = team.projects.map((p) => p.project.id);
  const manage = perms.has("team.manage");
  const [tasks, activity, wishes, usedToday, access, steps] = await Promise.all([
    projectIds.length
      ? db.task.findMany({
          where: {
            projectId: { in: projectIds },
            status: { not: "DONE" },
            OR: [{ assignee: { contains: "claude", mode: "insensitive" } }, { issueAssignees: { hasSome: ["Claude", "claude", "@claude"] } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, title: true, status: true, projectId: true, updatedAt: true, statusChangedAt: true, assignee: true, issueAssignees: true },
        })
      : [],
    projectIds.length ? db.activity.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "desc" }, take: 15, include: { user: userSelect } }) : [],
    db.teamWish.findMany({ where: { teamId }, orderBy: { createdAt: "desc" }, take: 50, include: { author: userSelect } }),
    db.teamWish.count({ where: { teamId, authorId: userId, createdAt: { gte: new Date(Date.now() - WISH_WINDOW_MS) } } }),
    manage ? Promise.all(projectIds.map(async (id) => ({ id, res: await accessOf(userId, id) }))) : Promise.resolve([]),
    recentAiSteps(projectIds),
  ]);
  const projectName = new Map(team.projects.map((p) => [p.project.id, p.project.name]));

  return {
    id: team.id,
    name: team.name,
    manage,
    members: team.members.map((m) => ({
      userId: m.userId,
      name: displayNameOf(m.user),
      username: m.user.username,
      role: m.roleRef ? { name: m.roleRef.name, key: m.roleRef.key } : null,
      me: m.userId === userId,
    })),
    projects: team.projects.map((p) => ({ id: p.project.id, name: p.project.name, status: p.project.status, openTasks: p.project._count.tasks, openErrors: p.project._count.appErrors })),
    ai: sortByProgress(tasks.filter((x) => isClaude(x.assignee, x.issueAssignees))).map((x) => ({
      id: x.id,
      title: x.title,
      status: x.status,
      projectId: x.projectId,
      project: projectName.get(x.projectId) ?? "",
      updatedAt: x.updatedAt.toISOString(),
      since: x.statusChangedAt.toISOString(),
    })),
    /** Letzte MCP-Schritte zu Aufgaben der Team-Projekte (#56) */
    aiSteps: steps.map((s) => ({ ...s, project: projectName.get(s.projectId) ?? "" })),
    activity: activity.map((a) => ({ id: a.id, summary: a.summary, projectId: a.projectId, project: projectName.get(a.projectId) ?? "", user: a.user ? displayNameOf(a.user) : null, at: a.createdAt.toISOString() })),
    wishes: wishes.map((w) => ({
      id: w.id,
      title: w.title,
      body: w.body,
      status: w.status as WishStatus,
      author: displayNameOf(w.author),
      mine: w.authorId === userId,
      reason: w.reason,
      projectId: w.projectId,
      at: w.createdAt.toISOString(),
    })),
    wishesLeft: wishesLeft(usedToday),
    /** Team-Projekte, in die ein Verwalter Wünsche als Aufgabe übernehmen darf */
    acceptProjects: access.filter((a) => a.res && canDo(a.res, "tasks.edit")).map((a) => ({ id: a.id, name: projectName.get(a.id) ?? "" })),
  };
}
export type TeamHubView = Awaited<ReturnType<typeof teamHub>>;

/** Was die KI zuletzt an Aufgaben dieser Projekte getan hat – nur Werkzeug, Aufgabe und Zeit, keine Inhalte. */
async function recentAiSteps(projectIds: string[]) {
  if (!projectIds.length) return [];
  const calls = await db.mcpCall.findMany({
    where: { taskId: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { taskId: true, tool: true, ok: true, createdAt: true },
  });
  const ids = [...new Set(calls.map((c) => c.taskId!))];
  const tasks = ids.length ? await db.task.findMany({ where: { id: { in: ids }, projectId: { in: projectIds } }, select: { id: true, title: true, projectId: true } }) : [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return calls
    .filter((c) => byId.has(c.taskId!))
    .slice(0, 15)
    .map((c) => {
      const task = byId.get(c.taskId!)!;
      return { tool: c.tool, ok: c.ok, at: c.createdAt.toISOString(), taskId: task.id, task: task.title, projectId: task.projectId };
    });
}

export async function teamMessages(teamId: string) {
  const rows = await db.teamMessage.findMany({ where: { teamId }, orderBy: { createdAt: "desc" }, take: 100, include: { author: userSelect } });
  return rows.reverse().map((m) => ({ id: m.id, body: m.body, author: displayNameOf(m.author), authorId: m.authorId, at: m.createdAt.toISOString() }));
}
export type TeamChatMessage = Awaited<ReturnType<typeof teamMessages>>[number];
