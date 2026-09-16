import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { projectCodeGraph } from "@/lib/codeGraph";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Code-Netz (#57): nur Pfade und Import-Verbindungen, keine Inhalte – und nur für Projektmitglieder.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`code-graph:${user.id}`, 30, 10 * MINUTE);
  return json({ graph: await projectCodeGraph(project.id) });
});
