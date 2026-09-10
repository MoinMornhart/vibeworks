import { PrismaClient } from "@prisma/client";

// Im Entwicklungsmodus lädt Next Module neu – ohne diesen Zwischenspeicher
// entstünde bei jedem Hot Reload ein neuer Verbindungspool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
