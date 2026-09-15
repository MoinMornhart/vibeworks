import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLES } from "./rolesLogic";

// Die Migration legt die Standardrollen an – sie muss zum Code passen.
describe("Standardrollen in der Migration", () => {
  const sql = readFileSync("prisma/migrations/20260915090000_roles/migration.sql", "utf8");
  it.each(BUILTIN_ROLES.filter((r) => r.scope === "project"))("$key", (role) => {
    const row = sql.split("\n").find((l) => l.includes(`'${role.id}'`));
    expect(row).toBeTruthy();
    const array = role.permissions.length ? `ARRAY[${role.permissions.map((p) => `'${p}'`).join(",")}]` : "ARRAY[]::TEXT[]";
    expect(row).toContain(array);
    expect(row).toContain(`'${role.key}'`);
    expect(row).toContain(`'${role.name}'`);
  });
});
