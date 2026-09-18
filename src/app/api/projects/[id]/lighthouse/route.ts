import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { GitError } from "@/lib/git/providers";
import { refreshLighthouse, serializeLighthouse, setLighthouse, setLighthouseSchedule, startLighthouse } from "@/lib/git/lighthouse";
import { safeLiveUrl } from "@/lib/git/lighthouseLogic";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const bodySchema = z.object({
  action: z.enum(["run", "refresh", "enable", "disable", "schedule"]),
  /** action "schedule": Rhythmus und Stunde in UTC (0–23) */
  schedule: z.enum(["daily", "weekly"]).optional(),
  hour: z.number().int().min(0).max(23).optional(),
});

// Lighthouse-Check eines Projekts (#82). Ansehen: Mitglieder. Jetzt prüfen und
// abfragen: „Git abgleichen“. Ein- und ausschalten legt bzw. entfernt eine
// Workflow-Datei im Repository – das darf nur der Besitzer.
async function view(projectId: string) {
  const [project, cache] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { lighthouse: true, liveUrl: true } }),
    db.repoCache.findUnique({ where: { projectId } }),
  ]);
  return serializeLighthouse(project?.lighthouse ?? false, project?.liveUrl ?? null, cache);
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json({ lighthouse: await view(project.id) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const body = await readBody(req, bodySchema, { maxBytes: 256 });
  const { project } = await requireProject(user.id, id, body.action === "enable" || body.action === "disable" || body.action === "schedule" ? "OWNER" : "git.sync");
  const cache = await db.repoCache.findUnique({ where: { projectId: id }, select: { provider: true } });
  if (!project.repoUrl || cache?.provider !== "github") throw new ApiError(400, tk("lighthouse", "errors.githubOnly"));

  let removed = false;
  let warning: string | null = null;
  if (body.action === "run") {
    limitOrThrow(`lighthouse-run:${id}`, 3, 10 * MINUTE);
    try {
      await startLighthouse(id);
    } catch (err) {
      if (err instanceof GitError) throw new ApiError(400, err.message);
      throw err;
    }
  } else if (body.action === "refresh") {
    limitOrThrow(`lighthouse:${user.id}`, 30, 10 * MINUTE);
    await refreshLighthouse(id);
  } else if (body.action === "schedule") {
    limitOrThrow(`lighthouse-switch:${id}`, 10, 10 * MINUTE);
    const res = await setLighthouseSchedule(id, body.schedule ?? "weekly", body.hour ?? 0);
    if (res.error) throw new ApiError(400, res.error);
  } else {
    if (body.action === "enable" && !safeLiveUrl(project.liveUrl)) throw new ApiError(400, tk("lighthouse", "errors.noLiveUrl"));
    limitOrThrow(`lighthouse-switch:${id}`, 10, 10 * MINUTE);
    ({ removed, error: warning } = await setLighthouse(id, body.action === "enable"));
  }
  return json({ lighthouse: await view(id), removed, warning });
});
