import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/roles";
import { cleanPermissions, MAX_OWN_ROLES, MAX_ROLE_DESCRIPTION, MAX_ROLE_NAME, type RoleScope } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const createSchema = z.object({
  scope: z.enum(["project", "team"]).default("project"),
  name: z.string().trim().min(1, tk("roles", "errors.nameEmpty")).max(MAX_ROLE_NAME, tk("roles", "errors.nameLong")),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION).nullish(),
  permissions: z.array(z.string().max(40)).max(40),
  /** Vorlage für die ganze Instanz – nur Admins */
  template: z.boolean().default(false),
});

const scopeOf = (v: string | null): RoleScope => (v === "team" ? "team" : "project");

// Verfügbare Rollen: Standard, Vorlagen der Instanz und die eigenen.
export const GET = route(async (req) => {
  const user = await requireApiUser();
  return json({ roles: await rolesFor(scopeOf(req.nextUrl.searchParams.get("scope")), user) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`roles:${user.id}`, 30, 10 * MINUTE);
  const input = await readBody(req, createSchema, { maxBytes: 4096 });
  if (input.template && user.role !== "ADMIN") throw new ApiError(403, tk("roles", "errors.templateAdminOnly"));
  if (!input.template && (await db.role.count({ where: { ownerId: user.id, scope: input.scope } })) >= MAX_OWN_ROLES) throw new ApiError(409, tk("roles", "errors.tooMany"));
  await db.role.create({
    data: {
      scope: input.scope,
      name: input.name,
      description: input.description || null,
      permissions: cleanPermissions(input.scope, input.permissions),
      ownerId: input.template ? null : user.id,
    },
  });
  return json({ roles: await rolesFor(input.scope, user) }, { status: 201 });
});
