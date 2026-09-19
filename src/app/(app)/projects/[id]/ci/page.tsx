import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { permsFromGrants, roleSelect, visibleTo } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { CiPanel } from "@/components/git/CiPanel";
import { ArrowLeft } from "lucide-react";

// Eigene Seite für den CI-Designer (#ci-designer): mehr Platz für die
// Node-Ansicht als auf der vollen Projektseite. Rechte wie dort: ci.manage.

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const user = await requirePageUser();
  const project = await db.project.findFirst({
    where: { id, ...visibleTo(user.id) },
    select: {
      id: true,
      name: true,
      ownerId: true,
      repoCache: { select: { provider: true } },
      ...roleSelect(user.id),
    },
  });
  if (!project) return null;
  const perms = permsFromGrants(project.ownerId, user.id, project);
  return { project, perms };
});

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const loaded = await load(id);
  return { title: loaded ? `${(await getT("ci"))("title")} – ${loaded.project.name}` : "404" };
}

export default async function CiPage({ params }: Props) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded || loaded.project.repoCache?.provider !== "github") notFound();
  const { project, perms } = loaded;
  const t = await getT("ci");
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${project.id}`} className="btn btn-sm" data-testid="ci-back">
          <ArrowLeft size={14} /> {project.name}
        </Link>
      </div>
      <CiPanel projectId={project.id} canEdit={perms.has("ci.manage")} />
      <span className="sr-only">{t("description")}</span>
    </main>
  );
}
