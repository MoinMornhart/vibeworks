import { db } from "./db";
import { displayNameOf } from "./auth/guard";

export interface Person {
  id: string;
  username: string;
  name: string;
}

const user = { select: { id: true, username: true, displayName: true, active: true } } as const;

/** Wer im Projekt mitarbeiten kann: Besitzer, Mitglieder und Mitglieder freigegebener Teams – ohne Doppelte und ohne gesperrte Konten. */
export async function projectPeople(projectId: string): Promise<Person[]> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: {
      owner: user,
      members: { select: { user } },
      teams: { select: { team: { select: { members: { select: { user } } } } } },
    },
  });
  if (!p) return [];
  const all = [p.owner, ...p.members.map((m) => m.user), ...p.teams.flatMap((t) => t.team.members.map((m) => m.user))];
  const seen = new Map<string, Person>();
  for (const u of all) if (u.active && !seen.has(u.id)) seen.set(u.id, { id: u.id, username: u.username, name: displayNameOf(u) });
  return [...seen.values()];
}

/** Passt der eingetragene Bearbeiter zu einer Person (Anzeigename, Benutzername oder @Benutzername)? */
export function personFor(people: Person[], assignee: string | null): Person | null {
  const needle = assignee?.trim().replace(/^@/, "").toLowerCase();
  if (!needle) return null;
  return people.find((p) => p.username.toLowerCase() === needle || p.name.toLowerCase() === needle) ?? null;
}
