import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { taskBulkSchema } from "@/lib/validation";
import { serializeTask } from "@/lib/tasks";
import { createTaskInProjects } from "@/lib/actions";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Dieselbe Aufgabe in mehreren Projekten anlegen (z. B. alle mit Git).
export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`task-bulk:${user.id}`, 20, 10 * MINUTE);
  const { projectIds, ...input } = await readBody(req, taskBulkSchema, { maxBytes: 64 * 1024 });
  const { created, skipped } = await createTaskInProjects(user.id, projectIds, input);
  return json({ created: created.map((c) => ({ ...serializeTask(c.task), project: c.project })), skipped }, { status: 201 });
});
