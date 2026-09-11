import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { graveActionSchema } from "@/lib/validation";
import { nextPosition } from "@/lib/projects";
import { logActivity } from "@/lib/activity";
import { SNOOZE_DAYS } from "@/lib/grave";

type Params = { id: string };

// Friedhof: begraben, wiederbeleben – und die Antworten auf „schläft seit
// 30 Tagen“: weitermachen oder später fragen.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const input = await readBody(req, graveActionSchema, { maxBytes: 4096 });
  const min = input.action === "bury" || input.action === "resurrect" ? "OWNER" : "EDITOR";
  const { project } = await requireProject(user.id, id, min);
  const snooze = new Date(Date.now() + SNOOZE_DAYS * 86_400_000);

  switch (input.action) {
    case "bury": {
      if (project.buriedAt) throw new ApiError(400, tk("grave", "errors.alreadyBuried"));
      await db.project.update({
        where: { id },
        data: {
          buriedAt: new Date(),
          statusBeforeBurial: project.status,
          status: "ARCHIVED",
          position: await nextPosition(project.ownerId, "ARCHIVED"),
          favorite: false,
          causeOfDeath: input.cause ?? null,
          epitaph: input.epitaph || null,
        },
      });
      await logActivity({ projectId: id, userId: user.id, kind: "PROJECT_UPDATED", summary: "Projekt begraben", meta: { action: "buried" } });
      break;
    }
    case "resurrect": {
      if (!project.buriedAt) throw new ApiError(400, tk("grave", "errors.notBuried"));
      const status = project.statusBeforeBurial && project.statusBeforeBurial !== "ARCHIVED" ? project.statusBeforeBurial : "OPEN";
      await db.project.update({
        where: { id },
        data: {
          buriedAt: null,
          status,
          statusBeforeBurial: null,
          causeOfDeath: null,
          epitaph: null,
          nudgeSnoozedUntil: snooze,
          position: await nextPosition(project.ownerId, status),
        },
      });
      await logActivity({ projectId: id, userId: user.id, kind: "PROJECT_UPDATED", summary: "Projekt wiederbelebt", meta: { action: "resurrected" } });
      break;
    }
    case "snooze":
      // Nur nicht mehr fragen – keine Änderung am Projekt, „zuletzt geändert“ bleibt
      await db.project.update({ where: { id }, data: { nudgeSnoozedUntil: snooze, updatedAt: project.updatedAt } });
      break;
    case "continue":
      // Weitermachen zählt als Lebenszeichen
      await db.project.update({ where: { id }, data: { nudgeSnoozedUntil: snooze } });
      break;
  }
  return json({ ok: true });
});
