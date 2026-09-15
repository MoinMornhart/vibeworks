import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { bannedHere, communityOn, loadThread, viewerOf } from "@/lib/community";
import { canWrite } from "@/lib/communityLogic";
import { getT } from "@/lib/i18n/server";
import { PostThread } from "@/components/community/PostThread";

type Props = { params: Promise<{ projectId: string; postId: string }> };

export default async function CommunityPostPage({ params }: Props) {
  const user = await requirePageUser();
  if (!(await communityOn())) notFound();
  const { projectId, postId } = await params;
  const viewer = await viewerOf(user);
  const thread = await loadThread(postId, viewer);
  if (!thread || thread.project.id !== projectId) notFound();
  const [t, banned] = await Promise.all([getT("community"), bannedHere(projectId, user.id)]);

  return (
    <div className="fade-in space-y-4">
      <Link href={`/community/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> {t("backToProject", { project: thread.project.name })}
      </Link>
      <PostThread
        projectId={projectId}
        initialPost={thread.post}
        initialReplies={thread.replies}
        canWrite={canWrite(viewer, banned)}
        moderator={thread.moderator}
        meId={user.id}
        ownerId={thread.project.ownerId}
      />
    </div>
  );
}
