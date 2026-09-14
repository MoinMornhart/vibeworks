import { after } from "next/server";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { credentialList } from "@/lib/git/token";
import { importFromCredential } from "@/lib/git/importRepos";
import { gitCredentialUpdateSchema } from "@/lib/validation";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

/** Automatischen Import ein- oder ausschalten – eingeschaltet läuft er gleich einmal. */
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { autoImport } = await readBody(req, gitCredentialUpdateSchema, { maxBytes: 1024 });
  const id = (await params).id;
  const { count } = await db.gitCredential.updateMany({ where: { id, userId: user.id }, data: { autoImport } });
  if (!count) throw notFound(tk("account", "errors.connectionNotFound"));
  if (autoImport) after(() => importFromCredential(id));
  return json({ connections: await credentialList(user.id) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.gitCredential.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) throw notFound(tk("account", "errors.connectionNotFound"));
  return json({ connections: await credentialList(user.id) });
});
