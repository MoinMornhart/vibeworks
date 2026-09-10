import { z } from "zod";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { publicBuildInfo } from "@/lib/buildInfo";
import { readUpdateStatus, requestUpdate, selfUpdateAvailable } from "@/lib/selfUpdate";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  await requireApiAdmin();
  const [available, { status, log }] = await Promise.all([selfUpdateAvailable(), readUpdateStatus()]);
  return json({ available, installed: publicBuildInfo(), status, log, now: new Date().toISOString() });
});

// Nach Updates suchen („check“) oder das neueste installieren („update“).
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  limitOrThrow(`self-update:${admin.id}`, 20, 10 * MINUTE);
  const { action } = await readBody(req, z.object({ action: z.enum(["check", "update"]) }));
  if (!(await selfUpdateAvailable())) {
    throw new ApiError(409, "Update per Knopfdruck ist auf dieser Installation nicht eingerichtet – bitte im Container „update“ ausführen.");
  }
  const requestedAt = new Date().toISOString();
  await requestUpdate(action);
  return json({ ok: true, requestedAt }, { status: 202 });
});
