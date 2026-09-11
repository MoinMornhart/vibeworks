import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { currentEntry } from "@/lib/timeServer";

// Laufender Timer des Kontos (oder null).
export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ current: await currentEntry(user.id) });
});
