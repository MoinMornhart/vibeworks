import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { ciStatus } from "@/lib/git/ciPipeline";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Jüngster CI-Lauf je Block (#107) – die Oberfläche fragt während eines Laufs alle paar Sekunden.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`ci-status:${project.id}:${user.id}`, 40, MINUTE);
  return json({ status: await ciStatus(project.id) });
});
