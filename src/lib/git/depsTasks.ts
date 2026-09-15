import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { makeT } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";
import { truncate } from "@/lib/utils";
import { pushTaskIssues } from "./issues";
import type { DepsReport } from "./depsLogic";
import { depsTaskAction, planDepsTasks, shortList } from "./depsTasksLogic";

// Was der Abhängigkeiten-Check markiert, steht sofort als Aufgabe im Projekt:
// eine für Sicherheitslücken, eine für Updates. Die Aufgaben pflegen sich
// selbst – neue Pakete kommen dazu, ist nichts mehr markiert, sind sie
// erledigt. Läuft auch im Hintergrund (ohne Anfrage), deshalb nicht über
// createTask/after().

/** Liefert die Zahl geänderter Aufgaben. */
export async function syncDepsTasks(projectId: string, report: DepsReport): Promise<number> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { status: true, buriedAt: true, owner: { select: { locale: true } } } });
  if (!project || project.status === "ARCHIVED" || project.buriedAt) return 0;
  const locale: Locale = project.owner.locale === "en" ? "en" : "de";
  const t = makeT(locale, "deps");
  const plans = planDepsTasks(report, { severity: (s) => t(`severity.${s}`), level: (l) => t(`level.${l}`) });
  if (!plans) return 0;

  const existing = await db.task.findMany({ where: { projectId, autoKey: { in: plans.map((p) => p.key) } } });
  const pushIds: string[] = [];
  for (const plan of plans) {
    const kind = plan.key === "deps:vuln" ? "vuln" : "update";
    const title = t(`tasks.${kind}.title`, { n: plan.names.length, packages: shortList(plan.names) }).slice(0, 200);
    const description = `${t(`tasks.${kind}.intro`)}\n\n${plan.lines.join("\n")}\n\n_${t("tasks.auto")}_`;
    const labels = kind === "vuln" ? [t("tasks.labelSecurity"), t("tasks.label")] : [t("tasks.label")];
    const task = existing.find((x) => x.autoKey === plan.key) ?? null;
    const action = depsTaskAction(task, { names: plan.names, description });

    if (action === "create") {
      const created = await db.task.create({
        data: { projectId, title, description, labels, autoKey: plan.key, status: "TODO", position: await nextTaskPosition(db, projectId, "TODO") },
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
    // Issues spiegeln wie bei jeder anderen Aufgabe (falls am Projekt eingeschaltet)
    void pushTaskIssues(pushIds).catch((err) => console.error("[deps-tasks]", projectId, err));
  }
  return pushIds.length;
}
