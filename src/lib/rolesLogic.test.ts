import { describe, expect, it } from "vitest";
import { BUILTIN_ROLES, cleanPermissions, EDITOR_PERMISSIONS, isSubset, legacyLevel, LEGACY_ROLE_ID, permissionsOf, PROJECT_PERMISSIONS, teamPermissionsOf } from "./rolesLogic";

describe("Rechte", () => {
  it("Standardrollen: steigend, Manager hat alles, Bearbeiter alles außer Mitglieder", () => {
    const perms = Object.fromEntries(BUILTIN_ROLES.map((r) => [r.key, new Set(r.permissions)]));
    expect(perms["project.viewer"].size).toBe(0);
    expect(isSubset(perms["project.contributor"], perms["project.editor"])).toBe(true);
    expect(isSubset(perms["project.editor"], perms["project.manager"])).toBe(true);
    expect(perms["project.manager"].size).toBe(PROJECT_PERMISSIONS.length);
    expect(perms["project.editor"].has("members.invite")).toBe(false);
    expect(LEGACY_ROLE_ID.EDITOR).toBe("role-project-editor");
  });
  it("Rechte aus mehreren Wegen werden vereinigt, fremde Einträge ignoriert", () => {
    const p = permissionsOf([
      { role: "VIEWER", roleRef: { permissions: ["tasks.edit", "unsinn"] } },
      { role: "VIEWER", roleRef: { permissions: ["costs.edit"] } },
    ]);
    expect([...p].sort()).toEqual(["costs.edit", "tasks.edit"]);
  });
  it("ohne Rolle gilt die alte Stufe – Ansehen heißt nichts, Bearbeiten wie früher", () => {
    expect(permissionsOf([{ role: "VIEWER", roleRef: null }]).size).toBe(0);
    expect([...permissionsOf([{ role: "EDITOR", roleRef: null }])]).toEqual(EDITOR_PERMISSIONS);
    expect(permissionsOf([]).size).toBe(0);
  });
  it("Team-Rechte: Rolle oder alte Stufe", () => {
    expect([...teamPermissionsOf({ role: "ADMIN", roleRef: null })]).toEqual(["team.invite", "team.remove", "team.roles", "team.manage"]);
    expect(teamPermissionsOf({ role: "MEMBER", roleRef: null }).size).toBe(0);
    expect([...teamPermissionsOf({ role: "ADMIN", roleRef: { permissions: ["team.invite", "tasks.edit"] } })]).toEqual(["team.invite"]);
    const byKey = Object.fromEntries(BUILTIN_ROLES.map((r) => [r.key, r]));
    expect(byKey["team.inviter"].permissions).toEqual(["team.invite"]);
    expect(byKey["team.member"].permissions).toEqual([]);
  });
  it("aufräumen: nur bekannte Rechte, feste Reihenfolge", () => {
    expect(cleanPermissions("project", ["members.invite", "tasks.edit", "tasks.edit", "admin.all"])).toEqual(["tasks.edit", "members.invite"]);
    expect(cleanPermissions("team", ["team.manage", "tasks.edit", "team.invite"])).toEqual(["team.invite", "team.manage"]);
  });
  it("Teilmenge und alte Stufe", () => {
    expect(isSubset(["tasks.edit"], new Set(["tasks.edit", "notes.edit"]))).toBe(true);
    expect(isSubset(["members.invite"], new Set(["tasks.edit"]))).toBe(false);
    expect(legacyLevel(new Set())).toBe("VIEWER");
    expect(legacyLevel(new Set(["time.track"]))).toBe("EDITOR");
  });
});
