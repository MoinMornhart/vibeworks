import type { ActivityKind, Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

// Verlauf je Projekt – erzählt, was passiert ist, statt jede Feldänderung
// mitzuschreiben. Höchstens 200 Einträge je Projekt.

type Client = PrismaClient | Prisma.TransactionClient;

const KEEP = 200;

export async function logActivity(
  data: { projectId: string; userId?: string | null; kind: ActivityKind; summary: string; meta?: Prisma.InputJsonValue },
  client: Client = db,
) {
  await client.activity.create({ data: { ...data, userId: data.userId ?? null } });
  const old = await client.activity.findMany({
    where: { projectId: data.projectId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: KEEP,
    select: { id: true },
  });
  if (old.length) await client.activity.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
