import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { importData } from "@/lib/transfer";
import { importSchema } from "@/lib/transferSchema";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// JSON-Export wieder einlesen – alles kommt neu dazu, nichts wird überschrieben.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`import:${user.id}`, 10, 10 * MINUTE);
  const data = await readBody(req, importSchema, { maxBytes: 25 * 1024 * 1024 });
  const counts = await importData(user.id, data);
  return json({ counts }, { status: 201 });
});
