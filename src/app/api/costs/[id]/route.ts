import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { costSchema } from "@/lib/validation";
import { serializeCost } from "@/lib/costs";

type Params = { id: string };

async function load(userId: string, id: string) {
  const cost = await db.projectCost.findUnique({ where: { id } });
  if (!cost) throw notFound(tk("costs", "errors.notFound"));
  await requireProject(userId, cost.projectId, "EDITOR");
  return cost;
}

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const current = await load(user.id, (await params).id);
  const { amount, ...input } = await readBody(req, costSchema, { maxBytes: 4096 });
  // Neuer Termin → wieder warnen
  const cost = await db.projectCost.update({
    where: { id: current.id },
    data: { ...input, amountCents: amount, ...(input.renewsOn !== current.renewsOn ? { notifiedFor: null } : {}) },
  });
  return json({ cost: serializeCost(cost) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const cost = await load(user.id, (await params).id);
  await db.projectCost.delete({ where: { id: cost.id } });
  return json({ ok: true });
});
