import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLES } from "./rolesLogic";

// Die Migrationen legen die Standardrollen an – sie müssen zum Code passen.
const FILES = { project: "prisma/migrations/20260915090000_roles/migration.sql", team: "prisma/migrations/20260915100000_team_roles/migration.sql" };

describe("Standardrollen in den Migrationen", () => {
  it.each(BUILTIN_ROLES)("$key", (role) => {
    const sql = readFileSync(FILES[role.scope], "utf8");
    const row = sql.split("\n").find((l) => l.includes(`'${role.id}'`) && l.includes("ARRAY"));
    expect(row).toBeTruthy();
    const array = role.permissions.length ? `ARRAY[${role.permissions.map((p) => `'${p}'`).join(",")}]` : "ARRAY[]::TEXT[]";
    expect(row).toContain(array);
    expect(row).toContain(`'${role.key}'`);
    expect(row).toContain(`'${role.name}'`);
    expect(row).toContain(`'${role.scope}'`);
  });
});
