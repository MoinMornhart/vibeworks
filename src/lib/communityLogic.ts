// Community ohne Datenbank: Arten, Grenzen und wer was darf.
// Moderieren dürfen der Projektbesitzer (in seinem Projekt) und Admins.

export const POST_KINDS = ["question", "idea", "bug"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const POST_STATUSES = ["open", "answered", "closed"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const REPORT_REASONS = ["spam", "abuse", "offtopic", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const MAX_TITLE = 150;
export const MAX_BODY = 10_000;
export const MAX_REPLY = 5_000;

export interface Viewer {
  id: string;
  isAdmin: boolean;
  /** Instanzweit gesperrt */
  banned: boolean;
}

type Who = Pick<Viewer, "id" | "isAdmin">;

export const canModerate = (v: Who, ownerId: string) => v.isAdmin || v.id === ownerId;

/** Ausgeblendetes sehen nur der Autor und die Moderation. */
export const canSee = (v: Who, item: { hidden: boolean; authorId: string }, ownerId: string) => !item.hidden || item.authorId === v.id || canModerate(v, ownerId);

/** Schreiben: weder instanzweit noch im Projekt gesperrt. */
export const canWrite = (v: Pick<Viewer, "banned">, bannedHere: boolean) => !v.banned && !bannedHere;

/** Bearbeiten nur der Autor, löschen auch die Moderation. */
export const canEdit = (v: Pick<Viewer, "id">, authorId: string) => v.id === authorId;
export const canDelete = (v: Who, authorId: string, ownerId: string) => v.id === authorId || canModerate(v, ownerId);

/** Kurzfassung ohne Markdown-Zeichen – für Listen und die Admin-Übersicht. */
export function excerpt(text: string, max = 160): string {
  const flat = text
    .replace(/[#>*_`~[\]()!|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
