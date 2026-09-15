import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser, type SessionUser } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/roles";
import { cleanPermissions, MAX_ROLE_DESCRIPTION, MAX_ROLE_NAME, type RoleScope } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const patchSchema = z.object({
  name: z.string().trim().min(1, tk("roles", "errors.nameEmpty")).max(MAX_ROLE_NAME, tk("roles", "errors.nameLong")).optional(),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION).nullish(),
  permissions: z.array(z.string().max(40)).max(40).optional(),
});

/** Ändern darf der Eigentümer; Vorlagen und Standardrollen nur ein Admin. Fremde Rollen: 404. */
async function editable(id: string, user: SessionUser) {
  const role = await db.role.findUnique({ where: { id } });
  if (!role || !(role.ownerId === user.id || (role.ownerId === null && user.role === "ADMIN"))) throw notFound(tk("roles", "errors.notEditable"));
  return role;
}

// Änderungen wirken sofort überall, wo die Rolle vergeben ist.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`roles:${user.id}`, 60, 10 * MINUTE);
  const role = await editable((await params).id, user);
  const input = await readBody(req, patchSchema, { maxBytes: 4096 });
  await db.role.update({
    where: { id: role.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.permissions !== undefined ? { permissions: cleanPermissions(role.scope as RoleScope, input.permissions) } : {}),
    },
  });
  return json({ roles: await rolesFor(role.scope as RoleScope, user) });
});

// Löschen: wer die Rolle hatte, fällt auf „nur lesen“ zurück. Standardrollen bleiben.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const role = await editable((await params).id, user);
  if (role.key) throw new ApiError(409, tk("roles", "errors.builtInDelete"));
  await db.role.delete({ where: { id: role.id } });
  return json({ roles: await rolesFor(role.scope as RoleScope, user) });
});
