import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { makeT } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";
import { truncate } from "@/lib/utils";
import { pushTaskIssues } from "./issues";
import { depsTaskAction, shortList } from "./depsTasksLogic";
import { isCheckTaskMode, planCheckTasks } from "./checkTasksLogic";
import type { CheckReport } from "./repoCheckLogic";

// Sammel-Aufgaben aus dem Repo-Check (#47) – je Art eine, sie pflegen sich
// selbst wie die Abhängigkeits-Aufgaben: neue Befunde kommen dazu, ist nichts
// mehr gemeldet, sind sie erledigt. Welche Arten, stellt der Besitzer ein.
// Die Befunde stehen nur mit Datei, Zeile und Regel drin – nie ein Geheimnis selbst.

/** Liefert die Zahl geänderter Aufgaben. */
export async function syncCheckTasks(projectId: string, report: CheckReport): Promise<number> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { status: true, buriedAt: true, checkTasks: true, owner: { select: { locale: true } } } });
  if (!project || project.status === "ARCHIVED" || project.buriedAt || !isCheckTaskMode(project.checkTasks)) return 0;
  const plans = planCheckTasks(report, project.checkTasks);
  if (!plans.length) return 0;
  const locale: Locale = project.owner.locale === "en" ? "en" : "de";
  const t = makeT(locale, "check");

  const existing = await db.task.findMany({ where: { projectId, autoKey: { in: plans.map((p) => p.key) } } });
  const pushIds: string[] = [];
  for (const plan of plans) {
    const title = t(`tasks.auto.${plan.kind}`, { n: plan.names.length, list: shortList(plan.names) }).slice(0, 200);
    const description = `${t(`tasks.intro.${plan.kind}`)}\n\n${plan.lines.join("\n")}\n\n_${t("tasks.autoNote")}_`;
    const labels = plan.kind === "findings" ? [t("tasks.label")] : [t("tasks.labelSecurity"), t("tasks.label")];
    const task = existing.find((x) => x.autoKey === plan.key) ?? null;
    const action = depsTaskAction(task, { names: plan.names, description });

    if (action === "create") {
      const created = await db.task.create({
        data: { projectId, title, description, labels, autoKey: plan.key, priority: plan.kind === "findings" ? 3 : 4, status: "TODO", position: await nextTaskPosition(db, projectId, "TODO"), createdVia: "auto" },
      });
      await logActivity({ projectId, userId: null, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(title, 60)}“ angelegt`, meta: { title: truncate(title, 60), taskId: created.id } });
      pushIds.push(created.id);
    } else if (action === "update") {
      await db.task.update({ where: { id: task!.id }, data: { title, description } });
      pushIds.push(task!.id);
    } else if (action === "reopen" || action === "close") {
      const to = action === "reopen" ? "TODO" : "DONE";
      const data = action === "reopen" ? { title, description } : {};
      await db.$transaction((tx) => transitionTask(tx, task!, to, null, { ...data, position: 0 }));
      pushIds.push(task!.id);
    }
  }
  if (pushIds.length) {
    await syncProjectProgress(projectId);
    void pushTaskIssues(pushIds).catch((err) => console.error("[check-tasks]", projectId, err));
  }
  return pushIds.length;
}
