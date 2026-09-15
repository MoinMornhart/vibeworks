import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { listInvites } from "@/lib/invites";

type Params = { id: string };

// Offene Einladung zurückziehen – genutzte bleiben als Nachweis in der Liste.
export const DELETE = route<Params>(async (_req, { params }) => {
  await requireApiAdmin();
  await db.invite.deleteMany({ where: { id: (await params).id, usedAt: null } });
  return json({ invites: await listInvites() });
});
