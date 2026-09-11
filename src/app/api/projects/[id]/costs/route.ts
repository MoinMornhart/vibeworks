import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { costSchema } from "@/lib/validation";
import { serializeCost } from "@/lib/costs";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id);
  const costs = await db.projectCost.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } });
  return json({ costs: costs.map(serializeCost) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id, "EDITOR");
  const { amount, ...input } = await readBody(req, costSchema, { maxBytes: 4096 });
  const cost = await db.projectCost.create({ data: { ...input, amountCents: amount, projectId: id } });
  return json({ cost: serializeCost(cost) }, { status: 201 });
});
