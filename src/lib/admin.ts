import { db } from "./db";

// Benutzerverwaltung. Administratoren verwalten Konten, nicht Inhalte:
// von fremden Projekten sehen sie nur die Anzahl.

export async function listUsers() {
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      lockedUntil: true,
      totpEnabledAt: true,
      passwordHash: true,
      createdAt: true,
      _count: { select: { projects: true, passkeys: true } },
    },
  });
  const now = Date.now();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    active: u.active,
    locked: Boolean(u.lockedUntil && u.lockedUntil.getTime() > now),
    twoFactor: Boolean(u.totpEnabledAt),
    hasPassword: Boolean(u.passwordHash),
    projects: u._count.projects,
    passkeys: u._count.passkeys,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));
}
export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

/** Gäbe es ohne dieses Konto keinen aktiven Administrator mehr? */
export async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
  return others === 0;
}
