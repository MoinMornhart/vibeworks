import { BUILTIN_ROLES, type ProjectPermission, type TeamPermission } from "@/lib/rolesLogic";
import type { TFunction } from "@/lib/i18n/messages";

// Anzeige von Rollen und Rechten: Standardrollen erscheinen übersetzt, solange
// niemand sie umbenannt hat; Rechte haben Schlüssel mit Unterstrich.

type Underscore<S extends string> = S extends `${infer A}.${infer B}` ? `${A}_${B}` : S;
type BuiltinKey = "project_viewer" | "project_contributor" | "project_editor" | "project_manager" | "project_bughunter" | "team_admin" | "team_inviter" | "team_member";

export const permKey = <P extends ProjectPermission | TeamPermission>(p: P) => p.replace(".", "_") as Underscore<P>;

function builtin(r: { key: string | null }) {
  return r.key ? BUILTIN_ROLES.find((b) => b.key === r.key) : undefined;
}

export function roleName(r: { name: string; key: string | null }, t: TFunction<"roles">): string {
  const b = builtin(r);
  return b && b.name === r.name ? t(`builtin.${b.key.replace(".", "_") as BuiltinKey}.name`) : r.name;
}

export function roleDescription(r: { description: string | null; key: string | null }, t: TFunction<"roles">): string | null {
  const b = builtin(r);
  return b && b.description === r.description ? t(`builtin.${b.key.replace(".", "_") as BuiltinKey}.description`) : r.description;
}
