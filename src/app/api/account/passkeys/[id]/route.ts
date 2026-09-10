import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { serializePasskey } from "@/lib/auth/webauthn";
import { passkeyRenameSchema } from "@/lib/validation";

type Params = { id: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { name } = await readBody(req, passkeyRenameSchema);
  const { count } = await db.passkey.updateMany({ where: { id, userId: user.id }, data: { name } });
  if (!count) throw notFound("Passkey nicht gefunden");
  return json({ passkey: serializePasskey(await db.passkey.findUniqueOrThrow({ where: { id } })) });
});

// Der letzte Passkey eines Kontos ohne Passwort bleibt – sonst käme niemand mehr hinein.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const passkey = await db.passkey.findFirst({ where: { id, userId: user.id } });
  if (!passkey) throw notFound("Passkey nicht gefunden");
  if (!user.passwordHash && (await db.passkey.count({ where: { userId: user.id } })) <= 1) {
    throw new ApiError(400, "Das ist dein einziger Zugang. Setze zuerst ein Passwort, bevor du den letzten Passkey entfernst.");
  }
  await db.passkey.delete({ where: { id } });
  return json({ ok: true });
});
