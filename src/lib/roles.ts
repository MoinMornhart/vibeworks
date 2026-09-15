import type { Role } from "@/generated/prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { tk } from "./i18n/messages";
import type { SessionUser } from "./auth/guard";
import { BUILTIN_ROLES, isSubset, type RoleScope } from "./rolesLogic";

// Rollen: Standardrollen und Vorlagen der Instanz (ownerId null, pflegen
// Admins) und eigene Rollen eines Kontos. Vergeben werden im Projekt nur
// Rollen, die dem Besitzer zur Verfügung stehen.

const order = (r: Role) => {
  const i = BUILTIN_ROLES.findIndex((b) => b.id === r.id);
  return i >= 0 ? i : r.ownerId === null ? 100 : 200;
};

/** Standard + Vorlagen + eigene Rollen dieses Kontos, in fester Reihenfolge. */
export async function availableRoles(scope: RoleScope, ownerId: string) {
  const rows = await db.role.findMany({ where: { scope, OR: [{ ownerId: null }, { ownerId }] } });
  return rows.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
}

export function serializeRole(r: Role, viewer: { id: string; isAdmin: boolean } | null) {
  return {
    id: r.id,
    scope: r.scope as RoleScope,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    key: r.key,
    builtIn: Boolean(r.key),
    template: r.ownerId === null,
    editable: Boolean(viewer && (r.ownerId === viewer.id || (r.ownerId === null && viewer.isAdmin))),
  };
}
export type RoleItem = ReturnType<typeof serializeRole>;

export async function rolesFor(scope: RoleScope, user: SessionUser) {
  return (await availableRoles(scope, user.id)).map((r) => serializeRole(r, { id: user.id, isAdmin: user.role === "ADMIN" }));
}

/** Rolle für eine Vergabe prüfen: gibt es sie, passt der Bereich, steht sie dem Besitzer zur Verfügung? */
export async function assignableProjectRole(roleId: string, projectOwnerId: string): Promise<Role> {
  const role = await db.role.findFirst({ where: { id: roleId, scope: "project", OR: [{ ownerId: null }, { ownerId: projectOwnerId }] } });
  if (!role) throw new ApiError(400, tk("roles", "errors.unknownRole"));
  return role;
}

/** Wer im Projekt handelt: Besitzer (alles) oder ein Mitglied mit seinen Rechten. */
export type Actor = { owner: boolean; perms: Set<string>; userId: string };
export const actorOf = (res: { access: string; perms: Set<string> }, userId: string): Actor => ({ owner: res.access === "OWNER", perms: res.perms, userId });

/** Grenze für „Mitglieder einladen“: Nicht-Besitzer vergeben nur Rollen mit höchstens ihren eigenen Rechten. */
export function assertWithin(permissions: string[], actor: Actor): void {
  if (!actor.owner && !isSubset(permissions, actor.perms)) throw new ApiError(403, tk("roles", "errors.aboveYou"));
}

/** Darf der Handelnde diese Vergabe ändern oder entfernen? Nicht sich selbst, nicht wer mehr darf. */
export const canManageGrant = (actor: Actor, targetUserId: string, targetPerms: Iterable<string>) =>
  actor.owner || (targetUserId !== actor.userId && isSubset(targetPerms, actor.perms));
