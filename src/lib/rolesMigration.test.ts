import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILTIN_ROLES } from "./rolesLogic";

// Die Migrationen legen die Standardrollen an – sie müssen zum Code passen.
// Gesucht wird in allen Migrationen, denn neue Standardrollen kommen mit neuen dazu.
const ALL_SQL = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => readFileSync(`prisma/migrations/${d.name}/migration.sql`, "utf8"))
  .join("\n");

describe("Standardrollen in den Migrationen", () => {
  it.each(BUILTIN_ROLES)("$key", (role) => {
    // Die jüngste Fassung zählt – spätere Migrationen setzen neue Rechte (#107)
    const row = ALL_SQL.split("\n").findLast((l) => l.includes(`'${role.id}'`) && l.includes("ARRAY"));
    expect(row).toBeTruthy();
    const array = role.permissions.length ? `ARRAY[${role.permissions.map((p) => `'${p}'`).join(",")}]` : "ARRAY[]::TEXT[]";
    expect(row).toContain(array);
    expect(row).toContain(`'${role.key}'`);
    expect(row).toContain(`'${role.name}'`);
    expect(row).toContain(`'${role.scope}'`);
    // Beschreibung gleich, sonst zeigt die Oberfläche die Übersetzung nicht an
    expect(row).toContain(`'${role.description}'`);
  });
});
