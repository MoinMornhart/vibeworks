import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { newShareToken, shareState } from "@/lib/share";
import { shareLinkSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  return json({ share: await shareState(project.id) });
});

// Öffentlichen Link einschalten, erneuern (alter Link wird ungültig) oder abschalten.
export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const { link } = await readBody(req, shareLinkSchema);
  const token = link === "off" ? null : link === "renew" || !project.shareToken ? newShareToken() : project.shareToken;
  if (token !== project.shareToken) {
    await db.project.update({ where: { id: project.id }, data: { shareToken: token } });
    const summary = link === "off" ? "Öffentlichen Link abgeschaltet" : link === "renew" ? "Öffentlichen Link erneuert" : "Öffentlichen Link eingeschaltet";
    const action = link === "off" ? "shareOff" : link === "renew" ? "shareRenew" : "shareOn";
    await logActivity({ projectId: project.id, userId: user.id, kind: "PROJECT_UPDATED", summary, meta: { action } });
  }
  return json({ share: await shareState(project.id) });
});
