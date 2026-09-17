import { z } from "zod";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { refreshDeps } from "@/lib/git/deps";
import { projectBranches } from "@/lib/git/codeCopy";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const schema = z.object({ branch: z.string().trim().max(200).regex(/^(?!.*\.\.)[\w][\w./-]*$/).optional() });

// Zweige für die Auswahl (#105) – ansehen darf, wer das Projekt sieht.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id);
  limitOrThrow(`deps-branches:${user.id}`, 20, MINUTE);
  return json({ branches: await projectBranches(id) });
});

// Abhängigkeiten sofort prüfen (sonst einmal am Tag beim Git-Abgleich) – auch für einen anderen Zweig.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { project } = await requireProject(user.id, id, "git.sync");
  if (!project.repoUrl) throw new ApiError(400, tk("deps", "errors.noRepo"));
  const { branch } = await readBody(req, schema, { maxBytes: 512 });
  limitOrThrow(`deps:${id}`, 5, MINUTE);
  const report = await refreshDeps(id, true, branch ?? null);
  if (!report) throw new ApiError(400, tk("deps", "errors.notSynced"));
  return json({ report });
});
