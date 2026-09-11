import Link from "next/link";
import { CalendarRange, History } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { visibleTo } from "@/lib/access";
import { getLocale, getT } from "@/lib/i18n/server";
import { loadFeed } from "@/lib/review";
import { Feed } from "@/components/review/Feed";

export const dynamic = "force-dynamic";

const PAGE = 100;

export async function generateMetadata() {
  const t = await getT("review");
  return { title: t("timeline.title") };
}

// Ganze Zeitleiste über alle sichtbaren Projekte – ohne JavaScript blätterbar
// („Ältere laden“ hängt einen Zeitstempel an), optional nach Projekt gefiltert.
export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ before?: string; project?: string }> }) {
  const user = await requirePageUser();
  const [sp, locale, t] = await Promise.all([searchParams, getLocale(), getT("review")]);
  const projects = await db.project.findMany({ where: visibleTo(user.id), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const projectId = projects.some((p) => p.id === sp.project) ? sp.project : undefined;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const items = await loadFeed(user.id, locale, { to: before, projectId, limit: PAGE });
  const older = items.length === PAGE ? `/timeline?${new URLSearchParams({ ...(projectId ? { project: projectId } : {}), before: items[items.length - 1].at })}` : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><History size={26} className="text-accent-ink" /> {t("timeline.title")}</h1>
          <p className="mt-1 text-muted">{t("timeline.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <select name="project" defaultValue={projectId ?? ""} className="field !w-auto" aria-label={t("timeline.projectFilter")}>
              <option value="">{t("timeline.allProjects")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm">{t("timeline.filter")}</button>
          </form>
          <Link href="/review" className="btn btn-sm"><CalendarRange size={15} /> {t("review.title")}</Link>
        </div>
      </header>

      <section className="glass p-6">
        <Feed items={items} locale={locale} />
        {older && (
          <div className="mt-6 text-center">
            <Link href={older} className="btn btn-sm">{t("timeline.older")}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
