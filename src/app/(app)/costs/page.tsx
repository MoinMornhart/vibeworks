import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { serializeCost } from "@/lib/costs";
import { dayKey } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { CostsOverview } from "@/components/costs/CostsOverview";

export async function generateMetadata() {
  const t = await getT("costs");
  return { title: t("overview.title") };
}

export default async function CostsPage() {
  const user = await requirePageUser();
  const costs = await db.projectCost.findMany({
    where: { project: { ownerId: user.id, buriedAt: null } },
    include: { project: { select: { id: true, name: true, accent: true } } },
    orderBy: [{ project: { name: "asc" } }, { createdAt: "asc" }],
  });
  return <CostsOverview today={dayKey(new Date())} costs={costs.map((c) => ({ ...serializeCost(c), project: c.project }))} />;
}
