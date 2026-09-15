// Teams ohne Datenbank: Rollen zusammenführen und prüfen, ob ein Team
// nach dem Gehen oder Herabstufen noch einen Admin hat.

export const TEAM_ROLES = ["ADMIN", "MEMBER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export type ShareRole = "VIEWER" | "EDITOR";

export const MAX_TEAM_NAME = 60;
/** So vielen Teams kann ein Konto höchstens angehören (Schutz vor Missbrauch). */
export const MAX_TEAMS = 50;

/** Stärkste Rolle aus direkter Mitgliedschaft und Team-Freigaben – null ohne Zugriff. */
export function bestRole(roles: ShareRole[]): ShareRole | null {
  if (!roles.length) return null;
  return roles.includes("EDITOR") ? "EDITOR" : "VIEWER";
}

type Member = { userId: string; role: string };

/**
 * Was passiert, wenn dieses Mitglied das Team verlässt (oder entfernt wird)?
 * ok · lastAdmin (es bleiben Mitglieder ohne Admin – vorher jemanden befördern)
 * · lastMember (das Team wäre leer – dann wird es gelöscht)
 */
export function leaveOutcome(members: Member[], userId: string): "ok" | "lastAdmin" | "lastMember" {
  const me = members.find((m) => m.userId === userId);
  if (!me) return "ok";
  if (members.length === 1) return "lastMember";
  if (me.role === "ADMIN" && !members.some((m) => m.userId !== userId && m.role === "ADMIN")) return "lastAdmin";
  return "ok";
}

/** Herabstufen geht nur, wenn danach noch ein anderer Admin da ist. */
export function canDemote(members: Member[], userId: string): boolean {
  return members.some((m) => m.userId !== userId && m.role === "ADMIN");
}
