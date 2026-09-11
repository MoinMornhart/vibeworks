import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { getLocale } from "@/lib/i18n/server";
import { claudeMdFor } from "@/lib/claudeMdServer";

type Params = { id: string };

// CLAUDE.md aus Beschreibung, Stand, offenen Aufgaben und Notizen.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  return json({ markdown: await claudeMdFor(project, await getLocale()) });
});
