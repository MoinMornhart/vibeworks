import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { resolveTheme, themeSchema } from "@/lib/theme";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ theme: resolveTheme(user.theme) });
});

// Persönliches Design speichern. `theme: null` setzt auf die Vorgabe zurück.
export const PUT = route(async (req) => {
  const user = await requireApiUser();
  const { theme } = await readBody(req, z.object({ theme: themeSchema.nullable() }));

  const uploadId = theme?.background.image.uploadId;
  if (uploadId) {
    const own = await db.upload.findFirst({ where: { id: uploadId, userId: user.id }, select: { id: true } });
    if (!own) throw new ApiError(400, "Das gewählte Bild gibt es nicht (mehr).", { "background.image.uploadId": "Unbekannt" });
  }

  await db.user.update({
    where: { id: user.id },
    data: { theme: theme === null ? Prisma.DbNull : (theme as unknown as Prisma.InputJsonValue) },
  });
  return json({ theme: resolveTheme(theme) });
});
