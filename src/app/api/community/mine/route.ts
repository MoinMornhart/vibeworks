import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { myCommunityProjects, requireCommunity, setMyCommunityProjects } from "@/lib/community";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const bodySchema = z.object({ projectIds: z.array(z.string().min(1).max(40)).max(500) });

// Eigene Projekte in der Community zeigen – wirkt nur auf Projekte des Kontos.
export const GET = route(async () => {
  const user = await requireApiUser();
  await requireCommunity(user);
  return json({ projects: await myCommunityProjects(user.id) });
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  await requireCommunity(user);
  limitOrThrow(`community-mine:${user.id}`, 20, 10 * MINUTE);
  const { projectIds } = await readBody(req, bodySchema, { maxBytes: 32 * 1024 });
  await setMyCommunityProjects(user.id, projectIds);
  return json({ projects: await myCommunityProjects(user.id) });
});
