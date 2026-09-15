import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser, type SessionUser } from "@/lib/auth/guard";
import { rolesFor, rolesForTeam } from "@/lib/roles";
import { keepsManager, requireTeamPerm, requireTeams } from "@/lib/teams";
import { cleanPermissions, isSubset, MAX_ROLE_DESCRIPTION, MAX_ROLE_NAME, type RoleScope } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const patchSchema = z.object({
  name: z.string().trim().min(1, tk("roles", "errors.nameEmpty")).max(MAX_ROLE_NAME, tk("roles", "errors.nameLong")).optional(),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION).nullish(),
  permissions: z.array(z.string().max(40)).max(40).optional(),
});

const aboveYou = () => new ApiError(403, tk("roles", "errors.aboveYou"));

/**
 * Ändern darf der Eigentümer; Vorlagen und Standardrollen nur ein Admin; Rollen
 * eines Teams, wer dort „Rollen vergeben“ darf – nur solche bis zu den eigenen
 * Rechten. Fremde Rollen: 404.
 */
async function editable(id: string, user: SessionUser) {
  const role = await db.role.findUnique({ where: { id } });
  if (!role) throw notFound(tk("roles", "errors.notEditable"));
  if (role.teamId) {
    await requireTeams();
    const { perms } = await requireTeamPerm(role.teamId, user.id, "team.roles");
    if (!isSubset(role.permissions, perms)) throw aboveYou();
    return { role, teamId: role.teamId, teamPerms: perms };
  }
  if (!(role.ownerId === user.id || (role.ownerId === null && user.role === "ADMIN"))) throw notFound(tk("roles", "errors.notEditable"));
  return { role, teamId: null, teamPerms: null };
}

async function listFor(ctx: Awaited<ReturnType<typeof editable>>, user: SessionUser) {
  return ctx.teamId ? rolesForTeam(ctx.teamId, user, ctx.teamPerms!) : rolesFor(ctx.role.scope as RoleScope, user);
}

// Änderungen wirken sofort überall, wo die Rolle vergeben ist.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`roles:${user.id}`, 60, 10 * MINUTE);
  const ctx = await editable((await params).id, user);
  const { role } = ctx;
  const input = await readBody(req, patchSchema, { maxBytes: 4096 });
  const permissions = input.permissions !== undefined ? cleanPermissions(role.scope as RoleScope, input.permissions) : undefined;
  if (ctx.teamId && permissions) {
    if (!isSubset(permissions, ctx.teamPerms!)) throw aboveYou();
    if (!(await keepsManager(ctx.teamId, role.id, permissions))) throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  }
  await db.role.update({
    where: { id: role.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(permissions ? { permissions } : {}),
    },
  });
  return json({ roles: await listFor(ctx, user) });
});

// Löschen: wer die Rolle hatte, fällt auf „nur lesen“ zurück. Standardrollen bleiben.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const ctx = await editable((await params).id, user);
  if (ctx.role.key) throw new ApiError(409, tk("roles", "errors.builtInDelete"));
  if (ctx.teamId && !(await keepsManager(ctx.teamId, ctx.role.id, null))) throw new ApiError(409, tk("teams", "errors.lastAdmin"));
  await db.role.delete({ where: { id: ctx.role.id } });
  return json({ roles: await listFor(ctx, user) });
});
