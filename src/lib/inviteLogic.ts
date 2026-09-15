// Einladungslinks ohne Datenbank: Laufzeiten, Zustand, Form des Codes.

export const INVITE_DAYS = [1, 7, 30] as const;
export type InviteDays = (typeof INVITE_DAYS)[number];
export type InviteStatus = "open" | "used" | "expired";

export const isInviteToken = (v: string) => /^[\w-]{16,64}$/.test(v);

export function inviteStatus(i: { usedAt: Date | string | null; expiresAt: Date | string }, now = Date.now()): InviteStatus {
  if (i.usedAt) return "used";
  return new Date(i.expiresAt).getTime() <= now ? "expired" : "open";
}

export const inviteExpiry = (days: number, now = Date.now()) => new Date(now + days * 86_400_000);
