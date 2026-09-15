import { UsersRound } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { teamsOn, teamsOverview } from "@/lib/teams";
import { getT } from "@/lib/i18n/server";
import { TeamsManager } from "@/components/teams/TeamsManager";

export async function generateMetadata() {
  return { title: (await getT("teams"))("title") };
}

export default async function TeamsPage() {
  const user = await requirePageUser();
  const t = await getT("teams");
  if (!(await teamsOn())) {
    return (
      <section className="glass mx-auto max-w-2xl p-8 text-center">
        <UsersRound className="mx-auto text-muted" size={28} />
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("off")}</p>
      </section>
    );
  }
  return <TeamsManager initial={await teamsOverview(user.id)} meId={user.id} />;
}
