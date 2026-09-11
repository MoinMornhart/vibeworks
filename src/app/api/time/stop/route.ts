import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { stopRunning } from "@/lib/timeServer";

export const POST = route(async () => {
  const user = await requireApiUser();
  const stopped = await stopRunning(user.id);
  return json({ stopped: stopped ? { id: stopped.id, seconds: stopped.seconds } : null });
});
