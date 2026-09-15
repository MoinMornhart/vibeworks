import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTeams } from "@/lib/teams";
import { teamHub } from "@/lib/teamHub";

type Params = { teamId: string };

// Team-Seite: Übersicht für Mitglieder (Fremde bekommen 404).
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  await requireTeams();
  return json({ hub: await teamHub((await params).teamId, user.id) });
});
