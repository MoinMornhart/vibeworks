import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { serializeTask } from "@/lib/tasks";
import { dayKey } from "@/lib/utils";
import { TaskOverview } from "@/components/tasks/TaskOverview";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT("tasks");
  return { title: t("overview.metaTitle") };
}

// Alle Aufgaben aus allen (nicht archivierten) Projekten, nach Fälligkeit.
// Den heutigen Kalendertag bestimmt der Server – so laufen Server-Render
// und Hydration nicht auseinander, und im Container (UTC) kippt abends
// nichts in den falschen Tag.
export default async function TasksPage() {
  const user = await requirePageUser();
  const tasks = await db.task.findMany({
    where: { project: { ownerId: user.id, status: { not: "ARCHIVED" } } },
    include: { project: { select: { id: true, name: true, accent: true } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return (
    <TaskOverview
      today={dayKey(new Date())}
      initial={tasks.map((t) => ({ ...serializeTask(t), project: t.project }))}
    />
  );
}
