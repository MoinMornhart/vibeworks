import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { taskDoneCounts } from "@/lib/projects";
import { getT } from "@/lib/i18n/server";
import { Graveyard } from "@/components/grave/Graveyard";

export async function generateMetadata() {
  const t = await getT("grave");
  return { title: t("page.title") };
}

export default async function GraveyardPage() {
  const user = await requirePageUser();
  const [rows, done] = await Promise.all([
    db.project.findMany({
      where: { ownerId: user.id, buriedAt: { not: null } },
      orderBy: { buriedAt: "desc" },
      select: {
        id: true,
        name: true,
        accent: true,
        createdAt: true,
        buriedAt: true,
        causeOfDeath: true,
        epitaph: true,
        repoCache: { select: { commits: true } },
        _count: { select: { notes: true, tasks: true } },
      },
    }),
    taskDoneCounts(user.id),
  ]);
  return (
    <Graveyard
      graves={rows.map((r) => ({
        id: r.id,
        name: r.name,
        accent: r.accent,
        bornAt: r.createdAt.toISOString(),
        buriedAt: (r.buriedAt ?? new Date()).toISOString(),
        cause: r.causeOfDeath,
        epitaph: r.epitaph,
        tasks: r._count.tasks,
        tasksDone: done.get(r.id) ?? 0,
        notes: r._count.notes,
        commits: Array.isArray(r.repoCache?.commits) ? r.repoCache.commits.length : 0,
      }))}
    />
  );
}
