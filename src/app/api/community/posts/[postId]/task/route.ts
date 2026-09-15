import { json, notFound, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { createTask } from "@/lib/actions";
import { postForChange, requireCommunity } from "@/lib/community";
import { canSee } from "@/lib/communityLogic";
import { appLink } from "@/lib/notify";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { postId: string };

// Community-Beitrag als Aufgabe übernehmen (#20): nur wer im Projekt Aufgaben
// anlegen darf (Mitglieder ab „Bearbeiter“). Mit Issue-Spiegelung entsteht
// daraus auch das GitHub-Issue – Beiträge anderer bleiben intern.
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const v = await requireCommunity(user);
  const { post, project } = await postForChange((await params).postId);
  if (!canSee(v, post, project.ownerId)) throw notFound(tk("community", "errors.postNotFound"));
  await requireProject(user.id, project.id, "tasks.edit");
  limitOrThrow(`community-task:${user.id}`, 30, 10 * MINUTE);
  const { task } = await createTask(user.id, project.id, {
    title: post.title.slice(0, 200),
    description: `${post.body}\n\n---\nAus der Community übernommen: ${appLink(`/community/${project.id}/${post.id}`)}`.slice(0, 20_000),
    status: "TODO",
    dueDate: null,
    labels: ["community"],
    recurrence: null,
  });
  return json({ taskId: task.id, projectId: project.id }, { status: 201 });
});
