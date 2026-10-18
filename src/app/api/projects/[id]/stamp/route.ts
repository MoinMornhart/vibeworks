import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { projectStamp } from "@/lib/projectStamp";

type Params = { id: string };

// Kurzer Änderungsstempel für die automatische Aktualisierung der Projektseite (#214).
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json({ stamp: await projectStamp(project.id) });
});
