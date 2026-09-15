import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guard";
import { teamsOn } from "@/lib/teams";
import { teamHub } from "@/lib/teamHub";
import { getT } from "@/lib/i18n/server";
import { TeamHub } from "@/components/teams/TeamHub";

type Props = { params: Promise<{ teamId: string }> };

export async function generateMetadata() {
  return { title: (await getT("teamHub"))("title") };
}

export default async function TeamHubPage({ params }: Props) {
  const user = await requirePageUser();
  if (!(await teamsOn())) notFound();
  // Fremde bekommen 404 – ob es das Team gibt, verrät die Seite nicht
  const hub = await teamHub((await params).teamId, user.id).catch(() => null);
  if (!hub) notFound();
  return <TeamHub initial={hub} meId={user.id} />;
}
