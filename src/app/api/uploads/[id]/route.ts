import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { isUploadId, readUpload, removeUploadFile } from "@/lib/uploads";
import { resolveTheme } from "@/lib/theme";
import { visibleTo } from "@/lib/access";

type Params = { id: string };

async function findOwn(userId: string, id: string) {
  if (!isUploadId(id)) throw notFound();
  const upload = await db.upload.findFirst({ where: { id, userId } });
  if (!upload) throw notFound();
  return upload;
}

// Bilder sind privat: ausgeliefert wird nur an das eigene Konto – Vorschaubilder
// von Live-Seiten zusätzlich an alle, die das Projekt sehen dürfen.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const id = (await params).id;
  if (!isUploadId(id)) throw notFound();
  let upload = await db.upload.findFirst({ where: { id, userId: user.id } });
  if (!upload && (await db.project.findFirst({ where: { coverUploadId: id, ...visibleTo(user.id) }, select: { id: true } }))) {
    upload = await db.upload.findFirst({ where: { id, kind: "cover" } });
  }
  if (!upload) throw notFound();
  const data = await readUpload(upload.id, upload.ext).catch(() => null);
  if (!data) throw notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": upload.mime,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const upload = await findOwn(user.id, (await params).id);
  await db.upload.delete({ where: { id: upload.id } });
  await removeUploadFile(upload.id, upload.ext);

  // Nutzt das gespeicherte Design dieses Bild, fällt es auf "kein Bild" zurück.
  const theme = resolveTheme(user.theme);
  let changed = null;
  if (theme.background.image.uploadId === upload.id) {
    theme.background.image.uploadId = null;
    if (theme.background.type === "image") theme.background.type = "preset";
    await db.user.update({ where: { id: user.id }, data: { theme: theme as unknown as Prisma.InputJsonValue } });
    changed = theme;
  }
  return json({ ok: true, theme: changed });
});
