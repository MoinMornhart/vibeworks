import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { visibleTo } from "@/lib/access";
import { serializePrompt } from "@/lib/prompts";
import { getT } from "@/lib/i18n/server";
import { PromptLibrary } from "@/components/prompts/PromptLibrary";

export async function generateMetadata() {
  const t = await getT("prompts");
  return { title: t("page.title") };
}

export default async function PromptsPage() {
  const user = await requirePageUser();
  const [prompts, projects] = await Promise.all([
    db.prompt.findMany({ where: { userId: user.id }, include: { project: { select: { id: true, name: true } } }, orderBy: [{ uses: "desc" }, { updatedAt: "desc" }] }),
    db.project.findMany({
      where: { ...visibleTo(user.id), status: { not: "ARCHIVED" } },
      select: { id: true, name: true, repoUrl: true, liveUrl: true, summary: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return <PromptLibrary initial={prompts.map(serializePrompt)} projects={projects} />;
}
