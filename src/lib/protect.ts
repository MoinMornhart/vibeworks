// Projekte mit Stern sind geschützt: nicht löschen oder begraben, bis der
// Stern weg ist; Status und Repository ändern sich nur nach ausdrücklicher
// Bestätigung. Ohne Datenbank, damit testbar.

export type ProtectedField = "status" | "repoUrl";

interface Current {
  favorite: boolean;
  status: string;
  repoUrl: string | null;
}

/** Welche geschützten Felder würde die Änderung anfassen? Leer bei Projekten ohne Stern. */
export function protectedChanges(current: Current, input: { status?: string; repoUrl?: string | null }): ProtectedField[] {
  if (!current.favorite) return [];
  const out: ProtectedField[] = [];
  if (input.status !== undefined && input.status !== current.status) out.push("status");
  if (input.repoUrl !== undefined && (input.repoUrl ?? null) !== (current.repoUrl ?? null)) out.push("repoUrl");
  return out;
}
