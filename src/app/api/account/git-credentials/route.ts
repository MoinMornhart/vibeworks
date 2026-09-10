import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { credentialData, credentialList, GitTokenError } from "@/lib/git/token";
import { gitCredentialSchema } from "@/lib/validation";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Git-Verbindungen des eigenen Kontos. Das Token wird beim Speichern beim
// Anbieter geprüft; eine Verbindung zum selben Server wird ersetzt.

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ connections: await credentialList(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`git-credential:${user.id}`, 20, 10 * MINUTE);
  const { provider, server, token } = await readBody(req, gitCredentialSchema, { maxBytes: 4096 });

  let data;
  try {
    data = await credentialData(provider, server, token);
  } catch (err) {
    if (err instanceof GitTokenError) throw new ApiError(err.status, err.message, { token: err.message });
    throw err;
  }
  await db.gitCredential.upsert({
    where: { userId_host: { userId: user.id, host: data.host } },
    create: { userId: user.id, ...data },
    update: data,
  });
  return json({ connections: await credentialList(user.id) }, { status: 201 });
});
