import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { downloadResponse, exportData } from "@/lib/transfer";
import { dayKey } from "@/lib/utils";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Ein Projekt exportieren – jedes Mitglied darf, was es ohnehin sehen kann.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`export:${user.id}`, 20, 10 * MINUTE);
  const { project } = await requireProject(user.id, (await params).id);
  const data = await exportData({ projectWhere: { id: project.id }, docsOwnerId: null });
  return downloadResponse(data, `vibeworks-${project.slug}-${dayKey(new Date())}.json`);
});
