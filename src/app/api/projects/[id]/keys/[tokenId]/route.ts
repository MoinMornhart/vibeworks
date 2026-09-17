import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { keysForProject, revokeProjectFromKey } from "@/lib/mcp/projectKeys";

type Params = { id: string; tokenId: string };

// Besitzer entzieht einem Projekt-Schlüssel den Zugriff (#106) – der Inhaber wird benachrichtigt.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id, tokenId } = await params;
  const { project } = await requireProject(user.id, id, "OWNER");
  await revokeProjectFromKey(project.id, tokenId, user.id);
  return json({ keys: await keysForProject(project.id) });
});
