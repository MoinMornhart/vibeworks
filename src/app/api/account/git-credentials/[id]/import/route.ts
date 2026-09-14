import { db } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { credentialList } from "@/lib/git/token";
import { importFromCredential } from "@/lib/git/importRepos";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

/** Jetzt importieren: alle Repositories der Verbindung, die noch kein Projekt haben. */
export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`git-import:${user.id}`, 10, 10 * MINUTE);
  const id = (await params).id;
  const cred = await db.gitCredential.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!cred) throw notFound(tk("account", "errors.connectionNotFound"));
  const result = await importFromCredential(cred.id);
  return json({ result, connections: await credentialList(user.id) });
});
