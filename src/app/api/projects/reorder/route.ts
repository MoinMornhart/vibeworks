import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { projectReorderSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { PROJECT_STATUS_MAP } from "@/lib/status";

// Neue Reihenfolge einer Kanban-Spalte. Der Client schickt die vollständige
// Liste der Spalte; der Server vergibt Position und Status daraus. Reines
// Umsortieren fasst das Änderungsdatum nicht an – sonst schöbe Aufräumen im
// Brett alles in „Zuletzt geändert“ nach oben. Fremde IDs werden ignoriert.
export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  const { status, ids } = await readBody(req, projectReorderSchema);

  const own = await db.project.findMany({ where: { ownerId: user.id, id: { in: ids } }, select: { id: true, status: true, name: true } });
  const byId = new Map(own.map((p) => [p.id, p]));
  const ordered = ids.filter((id) => byId.has(id));

  await db.$transaction(async (tx) => {
    for (const [index, id] of ordered.entries()) {
      const p = byId.get(id)!;
      if (p.status !== status) {
        await tx.project.update({ where: { id }, data: { status, position: index } });
        await logActivity(
          {
            projectId: id,
            userId: user.id,
            kind: "STATUS_CHANGED",
            summary: `Status: ${PROJECT_STATUS_MAP[p.status].label} → ${PROJECT_STATUS_MAP[status].label}`,
            meta: { from: p.status, to: status },
          },
          tx,
        );
      } else {
        await tx.$executeRaw`UPDATE "Project" SET "position" = ${index} WHERE "id" = ${id} AND "ownerId" = ${user.id}`;
      }
    }
  });
  return json({ ok: true, count: ordered.length });
});
