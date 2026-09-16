import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { conflictDetails, conflictPullRequests, resolveConflicts } from "@/lib/git/conflicts";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Merge-Konflikte (#92): ansehen darf, wer das Projekt sieht; die Lösung in
// den Pull Request schreiben nur der Besitzer – es läuft über seinen Zugang.

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load"), pr: z.number().int().positive() }),
  z.object({
    action: z.literal("resolve"),
    pr: z.number().int().positive(),
    headSha: z.string().regex(/^[0-9a-f]{40,64}$/),
    files: z
      .array(z.object({ path: z.string().min(1).max(500), content: z.string().max(2 * 1024 * 1024) }))
      .min(1)
      .max(20),
  }),
]);

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`conflicts:${user.id}`, 20, MINUTE);
  return json({ prs: await conflictPullRequests(project.id) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const id = (await params).id;
  const input = await readBody(req, postSchema, { maxBytes: 12 * 1024 * 1024 });
  if (input.action === "load") {
    const { project } = await requireProject(user.id, id);
    limitOrThrow(`conflicts-load:${user.id}`, 20, 10 * MINUTE);
    return json({ details: await conflictDetails(project.id, input.pr) });
  }
  const { project } = await requireProject(user.id, id, "OWNER");
  limitOrThrow(`conflicts-resolve:${user.id}`, 10, 10 * MINUTE);
  return json({ result: await resolveConflicts(project.id, user.id, input.pr, input.headSha, input.files) });
});
