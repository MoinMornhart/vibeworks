import { db } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_USER, saveUpload, sniffImage } from "@/lib/uploads";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";
import { tk } from "@/lib/i18n/messages";

export const GET = route(async () => {
  const user = await requireApiUser();
  const uploads = await db.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, size: true, mime: true, createdAt: true },
  });
  return json({ uploads });
});

// Bild hochladen (multipart/form-data, Feld "file").
export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`upload:${user.id}`, 20, 10 * MINUTE);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, tk("theme", "errors.imageTooLarge"));
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    throw new ApiError(415, tk("theme", "errors.multipartExpected"));
  }

  const count = await db.upload.count({ where: { userId: user.id } });
  if (count >= MAX_UPLOADS_PER_USER) {
    throw new ApiError(409, tk("theme", "errors.tooManyImages", { n: MAX_UPLOADS_PER_USER }));
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, tk("theme", "errors.noFile"));
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, tk("theme", "errors.imageTooLarge"));

  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new ApiError(415, tk("theme", "errors.imageFormat"));

  const upload = await saveUpload(user.id, buf, kind);
  return json({ upload: { id: upload.id, size: upload.size, mime: upload.mime, createdAt: upload.createdAt } }, { status: 201 });
});
