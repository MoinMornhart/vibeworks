import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { grantableProjects } from "@/lib/mcp/projectKeys";

// Projekte, die das Konto für einen Projekt-Schlüssel freigeben darf (#106).
export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ projects: await grantableProjects(user.id) });
});
