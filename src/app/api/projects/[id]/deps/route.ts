import { ApiError, json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { refreshDeps } from "@/lib/git/deps";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Abhängigkeiten sofort prüfen (sonst einmal am Tag beim Git-Abgleich).
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { project } = await requireProject(user.id, id, "EDITOR");
  if (!project.repoUrl) throw new ApiError(400, tk("deps", "errors.noRepo"));
  limitOrThrow(`deps:${id}`, 5, MINUTE);
  const report = await refreshDeps(id, true);
  if (!report) throw new ApiError(400, tk("deps", "errors.notSynced"));
  return json({ report });
});
