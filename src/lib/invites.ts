import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { getSettings } from "./settings";
import { inviteExpiry, inviteStatus, isInviteToken } from "./inviteLogic";

// Einladungslinks: der Admin erzeugt einen Code, der genau einmal und bis
// zum Ablauf ein Konto anlegen darf – auch bei geschlossener Registrierung.
// Gespeichert wird nur der SHA-256; den Link sieht der Admin nur beim Erzeugen.

const DAY = 86_400_000;

export async function createInvite(createdById: string, input: { note: string | null; days: number }) {
  const token = randomToken(24);
  await db.invite.create({ data: { tokenHash: sha256(token), hint: `…${token.slice(-4)}`, note: input.note, createdById, expiresAt: inviteExpiry(input.days) } });
  return token;
}

export async function listInvites() {
  // Längst abgelaufene, nie genutzte Einladungen aufräumen
  await db.invite.deleteMany({ where: { usedAt: null, expiresAt: { lt: new Date(Date.now() - 30 * DAY) } } });
  const rows = await db.invite.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const ids = rows.map((r) => r.usedById).filter((x): x is string => Boolean(x));
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } }) : [];
  const name = new Map(users.map((u) => [u.id, u.username]));
  return rows.map((r) => ({
    id: r.id,
    hint: r.hint,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    usedAt: r.usedAt?.toISOString() ?? null,
    usedBy: r.usedById ? (name.get(r.usedById) ?? null) : null,
    status: inviteStatus(r),
  }));
}
export type InviteItem = Awaited<ReturnType<typeof listInvites>>[number];

/** Gilt der Code noch? Nur im Mehrbenutzerbetrieb. */
export async function inviteUsable(token: string): Promise<boolean> {
  if (!isInviteToken(token) || (await getSettings()).mode !== "MULTI") return false;
  const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) }, select: { usedAt: true, expiresAt: true } });
  return Boolean(invite && inviteStatus(invite) === "open");
}

/** Einladung einlösen – atomar, damit ein Code nicht zweimal greift. */
export async function consumeInvite(tx: Prisma.TransactionClient, token: string): Promise<boolean> {
  const res = await tx.invite.updateMany({ where: { tokenHash: sha256(token), usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return res.count === 1;
}
