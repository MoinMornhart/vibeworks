import { db } from "@/lib/db";
import { displayNameOf } from "@/lib/auth/guard";
import { randomToken } from "@/lib/crypto";

// Teilen: öffentlicher Link (nur lesen, auch ohne Anmeldung), Mitglieder mit
// Rollen und Zugriffsanfragen, über die der Besitzer entscheidet.

export const newShareToken = () => randomToken(18);

const userSelect = { id: true, username: true, displayName: true } as const;

/** Alles, was der Besitzer im Teilen-Dialog sieht. */
export async function shareState(projectId: string) {
  const [project, members, requests] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { shareToken: true } }),
    db.projectMember.findMany({ where: { projectId }, include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } }),
    db.accessRequest.findMany({ where: { projectId, status: "PENDING" }, include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    shareToken: project.shareToken,
    members: members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      name: displayNameOf(m.user),
      role: m.role,
      since: m.createdAt.toISOString(),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      name: displayNameOf(r.user),
      role: r.role,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
export type ShareState = Awaited<ReturnType<typeof shareState>>;
