// Team-Seite (#38) ohne Datenbank: Grenzen für Wünsche und Chat, wer „Claude“
// ist, und in welcher Reihenfolge Claudes Aufgaben erscheinen.

export const WISH_LIMIT = 3;
/** Wünsche zählen je Mitglied über die letzten 24 Stunden */
export const WISH_WINDOW_MS = 24 * 3_600_000;
export const MAX_WISH_TITLE = 120;
export const MAX_WISH_BODY = 2000;
export const MAX_TEAM_MESSAGE = 2000;

export const WISH_STATUSES = ["open", "accepted", "declined"] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];

/** Ist die Aufgabe Claude zugeordnet – eingetragen („Claude“) oder laut Issue („🤖 Claude“ → „Claude“, „@claude“)? */
export function isClaude(assignee: string | null, fromIssue: string[] = []): boolean {
  return [assignee ?? "", ...fromIssue].some((n) => /^@?claude\b/i.test(n.trim()));
}

const ORDER = { DOING: 0, BLOCKED: 1, TODO: 2, DONE: 3 } as const;

/** Laufendes zuerst, dann Blockiertes, dann Offenes – innerhalb jeweils das zuletzt Geänderte oben. */
export function sortByProgress<T extends { status: keyof typeof ORDER; updatedAt: Date | string }>(list: T[]): T[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Grenze kommt aus den Admin-Einstellungen; WISH_LIMIT ist der Standard. */
export const MAX_WISH_LIMIT = 20;
export const wishesLeft = (usedToday: number, limit: number = WISH_LIMIT) => Math.max(0, limit - usedToday);
