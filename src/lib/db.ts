import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 verbindet sich über den pg-Treiber. Das Schema aus "?schema=…"
// kennt pg nicht – es geht deshalb als eigene Option an den Adapter.
function createClient() {
  const url = process.env.DATABASE_URL ?? "";
  let schema: string | undefined;
  try {
    schema = new URL(url).searchParams.get("schema") ?? undefined;
  } catch {
    /* ohne gültige URL scheitert erst die erste Abfrage – wie bisher */
  }
  const adapter = new PrismaPg({ connectionString: url }, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
