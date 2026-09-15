import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { GitError } from "@/lib/git/providers";
import { refreshRepoCheck, serializeRepoCheck, setRepoCheck, startRepoCheck } from "@/lib/git/repoCheck";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const bodySchema = z.object({ action: z.enum(["run", "refresh", "enable", "disable"]) });

// Repo-Check eines Projekts. Die Ergebnisse sehen nur Projektmitglieder;
// öffentliche Seiten bekommen sie nie (siehe serializeRepoCache).
async function view(projectId: string) {
  const [project, cache] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { repoCheck: true } }),
    db.repoCache.findUnique({ where: { projectId } }),
  ]);
  return serializeRepoCheck(project?.repoCheck ?? false, cache);
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json({ check: await view(project.id) });
});

// run: jetzt prüfen · refresh: Stand bei GitHub abfragen (Mitglieder mit Schreibrecht)
// enable/disable: nur der Besitzer – „aus“ nimmt die Datei wieder aus dem Repository.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { action } = await readBody(req, bodySchema, { maxBytes: 1024 });
  const switching = action === "enable" || action === "disable";
  const { project } = await requireProject(user.id, id, switching ? "OWNER" : "EDITOR");
  if (!project.repoUrl) throw new ApiError(400, tk("check", "errors.noRepo"));

  let removed = false;
  let warning: string | null = null;
  if (action === "run") {
    limitOrThrow(`repo-check-run:${id}`, 3, 10 * MINUTE);
    try {
      await startRepoCheck(id);
    } catch (err) {
      if (err instanceof GitError) throw new ApiError(400, err.message);
      throw err;
    }
  } else if (action === "refresh") {
    limitOrThrow(`repo-check:${user.id}`, 30, 10 * MINUTE);
    await refreshRepoCheck(id);
  } else {
    limitOrThrow(`repo-check-switch:${id}`, 10, 10 * MINUTE);
    ({ removed, error: warning } = await setRepoCheck(id, action === "enable"));
  }
  return json({ check: await view(id), removed, warning });
});
