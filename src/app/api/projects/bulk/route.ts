import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";
import { requireApiUser } from "@/lib/auth/guard";
import { projectBulkSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { normalizeTags } from "@/lib/utils";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { dropGitCache } from "@/lib/git/gitCli";
import { rememberRemovedRepo } from "@/lib/git/importRepos";

// Mehrfachaktionen auf ausgewählte Projekte. Fremde IDs fallen still heraus.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, projectBulkSchema);
  const projects = await db.project.findMany({
    where: { ownerId: user.id, id: { in: input.ids } },
    select: { id: true, name: true, status: true, tags: true, repoUrl: true, favorite: true },
  });
  const ids = projects.map((p) => p.id);
  if (!ids.length) return json({ ok: true, count: 0 });

  switch (input.action) {
    case "delete": {
      // Stern-Schutz: lieber gar nichts löschen als stillschweigend nur einen Teil
      const starred = projects.filter((p) => p.favorite);
      if (starred.length) throw new ApiError(409, tk("projects", "errors.protectedBulk", { names: starred.map((p) => p.name).join(", ") }));
      await db.project.deleteMany({ where: { ownerId: user.id, id: { in: ids } } });
      // Gelöschte Repositories nicht wieder importieren, git-Zwischenspeicher weg
      for (const p of projects) {
        await rememberRemovedRepo(user.id, p.repoUrl);
        await dropGitCache(p.id);
      }
      break;
    }
    case "favorite":
      await db.project.updateMany({ where: { ownerId: user.id, id: { in: ids } }, data: { favorite: input.favorite } });
      break;
    case "status": {
      const starred = projects.filter((p) => p.favorite && p.status !== input.status);
      if (starred.length && !input.confirmProtected) {
        throw new ApiError(409, tk("projects", "errors.protectedBulkChange", { names: starred.map((p) => p.name).join(", ") }), { confirm: "1" });
      }
      await db.$transaction(async (tx) => {
        for (const p of projects) {
          if (p.status === input.status) continue;
          await tx.project.update({ where: { id: p.id }, data: { status: input.status } });
          await logActivity(
            {
              projectId: p.id,
              userId: user.id,
              kind: "STATUS_CHANGED",
              summary: `Status: ${PROJECT_STATUS_MAP[p.status].label} → ${PROJECT_STATUS_MAP[input.status].label}`,
              meta: { from: p.status, to: input.status },
            },
            tx,
          );
        }
      });
      break;
    }
    case "addTags":
    case "removeTags":
      await db.$transaction(
        projects.map((p) => {
          const tags =
            input.action === "addTags" ? normalizeTags([...p.tags, ...input.tags]) : p.tags.filter((t) => !input.tags.includes(t));
          return db.project.update({ where: { id: p.id }, data: { tags } });
        }),
      );
      break;
  }
  return json({ ok: true, count: ids.length });
});
