import { db } from "./db";
import { displayNameOf } from "./auth/guard";
import { appLink, notifyUser } from "./notify";
import { personFor, projectPeople } from "./projectPeople";
import { truncate } from "./utils";

/**
 * Wer als Bearbeiter eingetragen wird und im Projekt ist, bekommt eine
 * Meldung – nicht, wer sich selbst einträgt, und nicht bei unverändertem
 * Eintrag. Freie Namen wie „Claude“ melden niemanden. Wirft nie.
 */
export async function notifyAssignee(task: { id: string; title: string; projectId: string; assignee: string | null }, actorId: string, previous: string | null): Promise<void> {
  try {
    if (!task.assignee || task.assignee === previous) return;
    const target = personFor(await projectPeople(task.projectId), task.assignee);
    if (!target || target.id === actorId) return;
    const [project, actor] = await Promise.all([
      db.project.findUnique({ where: { id: task.projectId }, select: { name: true } }),
      db.user.findUnique({ where: { id: actorId }, select: { username: true, displayName: true } }),
    ]);
    if (!project) return;
    await notifyUser(target.id, "assigned", (t) => ({
      event: "assigned",
      title: t("events.assigned.title", { title: truncate(task.title, 80) }),
      message: t("events.assigned.message", { name: actor ? displayNameOf(actor) : "?", project: project.name }),
      url: appLink(`/projects/${task.projectId}`),
    }));
  } catch (err) {
    console.error("[assign]", err);
  }
}
