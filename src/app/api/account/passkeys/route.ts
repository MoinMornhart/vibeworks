import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { serializePasskey } from "@/lib/auth/webauthn";

export const GET = route(async () => {
  const user = await requireApiUser();
  const passkeys = await db.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return json({ passkeys: passkeys.map(serializePasskey) });
});
