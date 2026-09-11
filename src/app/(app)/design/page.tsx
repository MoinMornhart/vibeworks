import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { ThemeEditor } from "@/components/theme/ThemeEditor";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT("theme");
  return { title: t("page.title") };
}

export default async function DesignPage() {
  const user = await requirePageUser();
  const uploads = await db.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, size: true, createdAt: true },
  });
  return <ThemeEditor initialUploads={uploads.map((u) => ({ id: u.id, size: u.size, createdAt: u.createdAt.toISOString() }))} />;
}
