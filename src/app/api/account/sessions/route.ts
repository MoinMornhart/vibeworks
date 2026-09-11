import { json, ApiError, route } from "@/lib/api";
import { getAuth } from "@/lib/auth/guard";
import { destroyAllSessions } from "@/lib/auth/session";
import { listSessions } from "@/lib/account";
import { tk } from "@/lib/i18n/messages";

async function auth() {
  const a = await getAuth();
  if (!a) throw new ApiError(401, tk("errors", "notLoggedIn"));
  return a;
}

export const GET = route(async () => {
  const { user, sessionId } = await auth();
  return json({ sessions: await listSessions(user.id, sessionId) });
});

// Überall abmelden – außer auf diesem Gerät.
export const DELETE = route(async () => {
  const { user, sessionId } = await auth();
  await destroyAllSessions(user.id, sessionId);
  return json({ sessions: await listSessions(user.id, sessionId) });
});
