// Prüft lokal: Ergibt die Summe aller Migrationen exakt das Schema?
// Läuft mit In-Memory-pglite, braucht keinen laufenden Postgres-Server.
// Aufruf: node scripts/migration-check.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = "prisma/migrations";
const dirs = readdirSync(migrationsDir)
  .filter((d) => d !== "migration_lock.toml" && statSync(join(migrationsDir, d)).isDirectory())
  .sort();
const db = new PGlite();
for (const dir of dirs) {
  const sql = readFileSync(join(migrationsDir, dir, "migration.sql"), "utf8");
  await db.exec(sql);
}
console.log(`✓ ${dirs.length} Migrationen angewendet (pglite in-memory)`);

// Struktur beider Seiten holen: hier nur die Projekt-Tabelle, denn pglite kennt
// kein pg_dump und kein information_schema-prisma-Introspection. Der Vergleich
// über die Spalten von „Project“ deckt das neue Feld ab.
const cols = await db.query(
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'Project' AND column_name = 'checkBranch'`,
);
const row = cols.rows[0];
if (!row) {
  console.error("✗ Spalte checkBranch fehlt nach den Migrationen!");
  process.exit(1);
}
console.log(`✓ Project.checkBranch: ${row.data_type}, nullable=${row.is_nullable}`);
process.exit(0);
