import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { cancelRun, serializeRun } from "@/lib/aiWorkflows";

type Params = { id: string };

// Laufenden KI-Workflow abbrechen (#101) – dann hören auch die Hinweise an die KI auf.
const schema = z.object({ cancel: z.literal(true), reason: z.string().trim().max(500).optional() });

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const input = await readBody(req, schema, { maxBytes: 2048 });
  const run = await cancelRun(user.id, (await params).id, input.reason || null);
  return json({ run: serializeRun(run) });
});
