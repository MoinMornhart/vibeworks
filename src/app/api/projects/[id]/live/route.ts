import { ApiError, json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { tk } from "@/lib/i18n/messages";
import { checkProjectNow } from "@/lib/monitor/run";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// „Jetzt prüfen“ – dieselbe Prüfung wie im Takt, sofort.
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { project } = await requireProject(user.id, id, "EDITOR");
  if (!project.liveUrl) throw new ApiError(400, tk("live", "errors.noLiveUrl"));
  limitOrThrow(`live-check:${id}`, 10, MINUTE);
  await checkProjectNow(id);
  return json({ ok: true });
});
