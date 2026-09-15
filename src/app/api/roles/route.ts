import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { rolesFor, rolesForTeam } from "@/lib/roles";
import { requireTeamMember, requireTeamPerm, requireTeams } from "@/lib/teams";
import { cleanPermissions, isSubset, MAX_OWN_ROLES, MAX_ROLE_DESCRIPTION, MAX_ROLE_NAME, type RoleScope } from "@/lib/rolesLogic";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const createSchema = z.object({
  scope: z.enum(["project", "team"]).default("project"),
  name: z.string().trim().min(1, tk("roles", "errors.nameEmpty")).max(MAX_ROLE_NAME, tk("roles", "errors.nameLong")),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION).nullish(),
  permissions: z.array(z.string().max(40)).max(40),
  /** Vorlage für die ganze Instanz – nur Admins */
  template: z.boolean().default(false),
  /** Eigene Rolle eines Teams – nur mit dem Team-Recht „Rollen vergeben“ */
  teamId: z.string().min(1).max(40).optional(),
});

const scopeOf = (v: string | null): RoleScope => (v === "team" ? "team" : "project");

// Verfügbare Rollen: Standard, Vorlagen der Instanz und die eigenen – mit
// ?teamId= die Rollen dieses Teams (nur für Mitglieder).
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const teamId = req.nextUrl.searchParams.get("teamId");
  if (teamId) {
    await requireTeams();
    const { perms } = await requireTeamMember(teamId, user.id);
    return json({ roles: await rolesForTeam(teamId, user, perms) });
  }
  return json({ roles: await rolesFor(scopeOf(req.nextUrl.searchParams.get("scope")), user) });
});

export const POST = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`roles:${user.id}`, 30, 10 * MINUTE);
  const input = await readBody(req, createSchema, { maxBytes: 4096 });
  const base = { name: input.name, description: input.description || null, permissions: cleanPermissions(input.scope, input.permissions) };

  if (input.teamId) {
    if (input.scope !== "team" || input.template) throw new ApiError(400, tk("roles", "errors.unknownRole"));
    await requireTeams();
    const { perms } = await requireTeamPerm(input.teamId, user.id, "team.roles");
    if (!isSubset(base.permissions, perms)) throw new ApiError(403, tk("roles", "errors.aboveYou"));
    if ((await db.role.count({ where: { teamId: input.teamId } })) >= MAX_OWN_ROLES) throw new ApiError(409, tk("roles", "errors.tooMany"));
    await db.role.create({ data: { ...base, scope: "team", teamId: input.teamId } });
    return json({ roles: await rolesForTeam(input.teamId, user, perms) }, { status: 201 });
  }

  if (input.template && user.role !== "ADMIN") throw new ApiError(403, tk("roles", "errors.templateAdminOnly"));
  // Team-Rollen gehören einem Team – außer den Vorlagen der Instanz
  if (input.scope === "team" && !input.template) throw new ApiError(400, tk("roles", "errors.teamOnly"));
  if (!input.template && (await db.role.count({ where: { ownerId: user.id, scope: input.scope } })) >= MAX_OWN_ROLES) throw new ApiError(409, tk("roles", "errors.tooMany"));
  await db.role.create({ data: { ...base, scope: input.scope, ownerId: input.template ? null : user.id } });
  return json({ roles: await rolesFor(input.scope, user) }, { status: 201 });
});
