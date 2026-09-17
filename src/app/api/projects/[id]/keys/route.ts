import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { keysForProject } from "@/lib/mcp/projectKeys";

type Params = { id: string };

// Projekt-Schlüssel mit Zugriff auf dieses Projekt (#106) – nur für den Besitzer.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  return json({ keys: await keysForProject(project.id) });
});
