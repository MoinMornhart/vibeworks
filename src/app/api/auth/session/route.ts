import { json, route } from "@/lib/api";
import { currentUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";

export const GET = route(async () => {
  const [user, settings] = await Promise.all([currentUser(), getSettings()]);
  return json({
    user: user && { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    mode: settings.mode,
    setupDone: Boolean(settings.setupDoneAt),
  });
});
