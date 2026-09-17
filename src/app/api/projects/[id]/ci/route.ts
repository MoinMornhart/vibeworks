import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { displayNameOf, requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { ciView, publishCi, runCi, saveCi } from "@/lib/git/ciPipeline";
import { logActivity } from "@/lib/activity";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// CI-Designer (#107): ansehen darf, wer das Projekt sieht; speichern, ins
// Repository schreiben und starten nur mit dem Recht „CI verwalten“.

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`ci-view:${user.id}`, 30, MINUTE);
  return json({ ci: await ciView(project.id) });
});

export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "ci.manage");
  const { pipeline } = await readBody(req, z.object({ pipeline: z.unknown() }), { maxBytes: 64_000 });
  await saveCi(project.id, pipeline);
  return json({ ci: await ciView(project.id) });
});

const actionSchema = z.object({ action: z.enum(["publish", "run"]) });

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "ci.manage");
  const { action } = await readBody(req, actionSchema, { maxBytes: 256 });
  limitOrThrow(`ci-${action}:${project.id}`, 10, 10 * MINUTE);
  if (action === "run") {
    await runCi(project.id);
    return json({ started: true });
  }
  const result = await publishCi(project.id, displayNameOf(user));
  if (result !== "current") await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary: "CI-Pipeline ins Repository geschrieben", meta: { fields: ["ci"] } });
  return json({ result, ci: await ciView(project.id) });
});
