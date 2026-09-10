import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { ThemeEditor } from "@/components/theme/ThemeEditor";

export const metadata = { title: "Design" };

export default async function DesignPage() {
  const user = await requirePageUser();
  const uploads = await db.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, size: true, createdAt: true },
  });
  return <ThemeEditor initialUploads={uploads.map((u) => ({ id: u.id, size: u.size, createdAt: u.createdAt.toISOString() }))} />;
}
