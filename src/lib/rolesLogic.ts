// Rollen ohne Datenbank: welche Rechte es gibt, die Standardrollen und wie aus
// Mitgliedschaften (direkt und über Teams) die Rechte eines Kontos werden.
// Besitzerrechte (Löschen, Repository/Token, öffentlicher Link, Team-Freigaben)
// sind bewusst kein Recht – die hat nur der Besitzer.

export const PROJECT_PERMISSIONS = [
  "tasks.edit",
  "tasks.delete",
  "notes.edit",
  "project.edit",
  "costs.edit",
  "time.track",
  "git.sync",
  "live.check",
  "errors.manage",
  "workflows.manage",
  "ci.manage",
  "members.invite",
  "keys.grant",
] as const;
export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

/** Rechte nach Bereichen – für die Rollen-Oberfläche (#107). Jedes Recht genau einmal (Test). */
export const PERMISSION_GROUPS: ReadonlyArray<{ key: "work" | "project" | "code" | "access"; permissions: readonly ProjectPermission[] }> = [
  { key: "work", permissions: ["tasks.edit", "tasks.delete", "notes.edit", "time.track"] },
  { key: "project", permissions: ["project.edit", "costs.edit", "workflows.manage"] },
  { key: "code", permissions: ["git.sync", "ci.manage", "live.check", "errors.manage"] },
  { key: "access", permissions: ["members.invite", "keys.grant"] },
];

/** Rechte, die Zugriff weitergeben oder Code im Repository ausführen – in der Oberfläche hervorgehoben. */
export const SENSITIVE_PERMISSIONS: readonly ProjectPermission[] = ["members.invite", "keys.grant", "ci.manage"];

export const TEAM_PERMISSIONS = ["team.invite", "team.remove", "team.roles", "team.workflows", "team.manage"] as const;
export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export type RoleScope = "project" | "team";
const ROLE_SCOPES: RoleScope[] = ["project", "team"];

export const MAX_ROLE_NAME = 40;
export const MAX_ROLE_DESCRIPTION = 200;
/** So viele eigene Rollen je Konto und Bereich. */
export const MAX_OWN_ROLES = 30;

/** Was die alte Rolle „Bearbeiten“ durfte: alles außer Zugriff weitergeben (Mitglieder, Projekt-Schlüssel). */
export const EDITOR_PERMISSIONS: ProjectPermission[] = PROJECT_PERMISSIONS.filter((p) => p !== "members.invite" && p !== "keys.grant");

export interface BuiltinRole {
  id: string;
  key: string;
  scope: RoleScope;
  name: string;
  description: string;
  permissions: string[];
}

/** Standardrollen – die Migration legt sie mit genau diesen IDs an. Bearbeitbar, nicht löschbar. */
export const BUILTIN_ROLES: BuiltinRole[] = [
  { id: "role-project-viewer", key: "project.viewer", scope: "project", name: "Betrachter", description: "Sieht alles, ändert nichts.", permissions: [] },
  { id: "role-project-contributor", key: "project.contributor", scope: "project", name: "Mitwirkender", description: "Arbeitet an Aufgaben mit und erfasst Zeit.", permissions: ["tasks.edit", "time.track"] },
  { id: "role-project-editor", key: "project.editor", scope: "project", name: "Bearbeiter", description: "Ändert Inhalte, Status und Kosten – Mitglieder verwaltet er nicht.", permissions: EDITOR_PERMISSIONS },
  { id: "role-project-manager", key: "project.manager", scope: "project", name: "Manager", description: "Wie Bearbeiter und darf Mitglieder einladen und verwalten.", permissions: [...PROJECT_PERMISSIONS] },
  {
    id: "role-project-bughunter",
    key: "project.bughunter",
    scope: "project",
    name: "Bughunter",
    description: "Findet und behebt Fehler: Aufgaben, Notizen, Zeit, Git- und Live-Prüfung, Fehler-Eingang – ohne Mitglieder, Kosten und Projektangaben.",
    permissions: ["tasks.edit", "notes.edit", "time.track", "git.sync", "ci.manage", "live.check", "errors.manage"],
  },
  { id: "role-team-admin", key: "team.admin", scope: "team", name: "Admin", description: "Verwaltet Mitglieder, Einladungen, Rollen und das Team selbst.", permissions: [...TEAM_PERMISSIONS] },
  { id: "role-team-inviter", key: "team.inviter", scope: "team", name: "Einlader", description: "Darf Leute einladen, aber niemanden entfernen.", permissions: ["team.invite"] },
  { id: "role-team-member", key: "team.member", scope: "team", name: "Mitglied", description: "Nimmt teil und sieht die Team-Projekte.", permissions: [] },
];

/** Die alte Stufe als Standardrolle – für Anfragen („ansehen“/„bearbeiten“) und Übergänge. */
export const LEGACY_ROLE_ID = { VIEWER: "role-project-viewer", EDITOR: "role-project-editor" } as const;
/** Alte Team-Stufen als Standardrolle. */
export const LEGACY_TEAM_ROLE_ID = { ADMIN: "role-team-admin", MEMBER: "role-team-member" } as const;

/** Team-Rechte eines Mitglieds – ohne Rolle gilt die alte Stufe (Admin: alles, Mitglied: nichts). */
export function teamPermissionsOf(g: { role: string; roleRef: { permissions: string[] } | null }): Set<TeamPermission> {
  const list = g.roleRef ? g.roleRef.permissions : g.role === "ADMIN" ? [...TEAM_PERMISSIONS] : [];
  return new Set(list.filter((p): p is TeamPermission => (TEAM_PERMISSIONS as readonly string[]).includes(p)));
}

const known = (scope: RoleScope): readonly string[] => (scope === "project" ? PROJECT_PERMISSIONS : TEAM_PERMISSIONS);

/** Nur bekannte Rechte, ohne Doppelte, in fester Reihenfolge. */
export function cleanPermissions(scope: RoleScope, list: string[]): string[] {
  const wanted = new Set(list);
  return known(scope).filter((p) => wanted.has(p));
}

type Grant = { role: "VIEWER" | "EDITOR"; roleRef: { permissions: string[] } | null };

/**
 * Rechte aus allen Wegen zusammen (direkte Mitgliedschaft, Team-Freigaben) –
 * die Vereinigung. Ohne Rolle (etwa nach dem Löschen einer eigenen Rolle)
 * gilt die gespeicherte alte Stufe; neue Vergaben speichern dort „Ansehen“.
 */
export function permissionsOf(grants: Grant[]): Set<ProjectPermission> {
  const out = new Set<ProjectPermission>();
  for (const g of grants) {
    const list = g.roleRef ? g.roleRef.permissions : g.role === "EDITOR" ? EDITOR_PERMISSIONS : [];
    for (const p of list) if ((PROJECT_PERMISSIONS as readonly string[]).includes(p)) out.add(p as ProjectPermission);
  }
  return out;
}

export const allProjectPermissions = () => new Set<ProjectPermission>(PROJECT_PERMISSIONS);

/** Liegen alle Rechte von a auch in b? (Grenze für „Mitglieder einladen“) */
export function isSubset(a: Iterable<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Die alte Stufe, die zu einer Rechte-Menge passt – für Anzeigen, die nur „ansehen/bearbeiten“ kennen. */
export const legacyLevel = (perms: Set<string>): "VIEWER" | "EDITOR" => (perms.size > 0 ? "EDITOR" : "VIEWER");
