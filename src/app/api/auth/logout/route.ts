import { json, route } from "@/lib/api";
import { clearSessionCookie, destroySession, readSessionToken } from "@/lib/auth/session";

export const POST = route(async () => {
  const token = await readSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return json({ ok: true });
});
