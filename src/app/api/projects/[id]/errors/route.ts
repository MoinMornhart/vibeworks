import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { randomToken } from "@/lib/crypto";
import { errorEndpoint, loadErrors, serializeAppError } from "@/lib/bugs";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const bodySchema = z.object({ action: z.enum(["enable", "rotate", "disable"]) });

// Fehler-Eingang eines Projekts: die Fehler sehen alle Mitglieder, die
// Adresse mit Schlüssel und das Ein-/Ausschalten nur der Besitzer.
async function view(projectId: string, owner: boolean) {
  const [project, errors] = await Promise.all([db.project.findUnique({ where: { id: projectId }, select: { errorKey: true } }), loadErrors(projectId)]);
  const key = project?.errorKey ?? null;
  return { errors: errors.map(serializeAppError), enabled: Boolean(key), endpoint: owner && key ? errorEndpoint(key) : null, canManage: owner };
}

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { project, access } = await requireProject(user.id, (await params).id);
  return json(await view(project.id, access === "OWNER"));
});

// enable: Schlüssel anlegen (falls noch keiner) · rotate: neuer Schlüssel, der alte gilt nicht mehr · disable: Adresse weg
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  limitOrThrow(`bugs-key:${user.id}`, 20, 10 * MINUTE);
  const { action } = await readBody(req, bodySchema, { maxBytes: 512 });
  const current = await db.project.findUnique({ where: { id: project.id }, select: { errorKey: true } });
  const errorKey = action === "disable" ? null : action === "rotate" || !current?.errorKey ? randomToken(24) : current.errorKey;
  await db.project.update({ where: { id: project.id }, data: { errorKey } });
  return json(await view(project.id, true));
});
