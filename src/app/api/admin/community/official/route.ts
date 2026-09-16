import { z } from "zod";
import { db } from "@/lib/db";
import { json, notFound, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { tk } from "@/lib/i18n/messages";

const schema = z.object({ projectId: z.string().min(1).max(40), official: z.boolean() });

// „Offizielles Projekt“ (#59): nur Admins – es steht dann oben in der Community.
export const PUT = route(async (req) => {
  await requireApiAdmin();
  const { projectId, official } = await readBody(req, schema, { maxBytes: 256 });
  // Per SQL, damit „zuletzt geändert“ des Projekts nicht springt
  const count = await db.$executeRaw`UPDATE "Project" SET "communityOfficial" = ${official} WHERE "id" = ${projectId} AND "inCommunity" = true`;
  if (!count) throw notFound(tk("community", "errors.projectNotFound"));
  return json({ official });
});
