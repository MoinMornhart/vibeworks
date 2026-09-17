import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { getLocale } from "@/lib/i18n/server";
import { claudeMdFor } from "@/lib/claudeMdServer";
import { agentFile, isAgentTarget } from "@/lib/agentFileLogic";

type Params = { id: string };

// KI-Anleitung aus Beschreibung, Stand, offenen Aufgaben und Notizen – als CLAUDE.md
// oder für andere KIs (?target=agents, gemini, copilot, cursor, windsurf, cline; #107).
export const GET = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  const target = req.nextUrl.searchParams.get("target");
  const markdown = await claudeMdFor(project, await getLocale());
  const file = agentFile(isAgentTarget(target) ? target : "claude", markdown, project.summary || project.name);
  return json({ markdown: file.content, path: file.path });
});
