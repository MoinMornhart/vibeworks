import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 liest die .env nicht mehr selbst – dotenv lädt sie hier (auf dem
// Server liegt sie als Symlink im Release-Ordner). Ohne DATABASE_URL läuft
// `prisma generate` trotzdem; nur Migrationen brauchen die Verbindung.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
