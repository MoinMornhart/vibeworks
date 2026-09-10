import { db } from "@/lib/db";
import { ApiError, json, notFound, route } from "@/lib/api";
import { getAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/account";

type Params = { id: string };

// Eine einzelne andere Sitzung beenden. Die eigene beendet man über „Abmelden“.
export const DELETE = route<Params>(async (_req, { params }) => {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "Nicht angemeldet");
  const { id } = await params;
  if (id === auth.sessionId) throw new ApiError(400, "Die eigene Sitzung beendest du über „Abmelden“.");
  const { count } = await db.session.deleteMany({ where: { id, userId: auth.user.id } });
  if (!count) throw notFound("Sitzung nicht gefunden");
  return json({ sessions: await listSessions(auth.user.id, auth.sessionId) });
});
