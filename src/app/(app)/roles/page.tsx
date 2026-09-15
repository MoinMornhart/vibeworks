import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/roles";
import { getT } from "@/lib/i18n/server";
import { RolesManager } from "@/components/roles/RolesManager";

export async function generateMetadata() {
  return { title: (await getT("roles"))("title") };
}

export default async function RolesPage() {
  const user = await requirePageUser();
  const [t, roles] = await Promise.all([getT("roles"), rolesFor("project", user)]);
  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <ShieldCheck size={28} className="text-accent-ink" /> {t("title")}
        </h1>
        <p className="mt-1 max-w-3xl text-muted">{t("intro")}</p>
      </header>
      <section className="glass p-6 sm:p-8" aria-labelledby="project-roles">
        <h2 id="project-roles" className="mb-3 text-lg font-semibold">{t("section.project")}</h2>
        <RolesManager mode="own" initial={roles} />
      </section>
      <section className="glass p-6 sm:p-8" aria-labelledby="team-roles">
        <h2 id="team-roles" className="mb-3 text-lg font-semibold">{t("section.team")}</h2>
        <p className="text-sm text-muted">{t("teamRolesWhere")}</p>
        <Link href="/teams" className="btn btn-sm mt-3">{t("openTeams")}</Link>
      </section>
    </div>
  );
}
