import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { visibleTo } from "@/lib/access";
import { serializeInbox } from "@/lib/inboxServer";
import { getT } from "@/lib/i18n/server";
import { InboxView } from "@/components/inbox/InboxView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("inbox");
  return { title: t("title") };
}

export default async function InboxPage() {
  const user = await requirePageUser();
  const [items, projects] = await Promise.all([
    db.inboxItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.project.findMany({
      where: { ...visibleTo(user.id), status: { not: "ARCHIVED" }, buriedAt: null },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return <InboxView initial={items.map(serializeInbox)} projects={projects} />;
}
