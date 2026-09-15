// Erinnerung, das Passwort zu wechseln: einstellbar je Konto (0 = aus),
// höchstens alle 30 Tage eine Meldung, bis ein neues gesetzt ist.

export const REMINDER_OPTIONS = [0, 90, 180, 365] as const;
export const REMINDER_REPEAT_DAYS = 30;
const DAY = 86_400_000;

/** Alter des Passworts in Tagen, wenn jetzt erinnert werden soll – sonst null. */
export function passwordReminderDue(
  u: { changedAt: Date | null; createdAt: Date; days: number; remindedAt: Date | null },
  now: Date,
): number | null {
  if (u.days <= 0) return null;
  const age = Math.floor((now.getTime() - (u.changedAt ?? u.createdAt).getTime()) / DAY);
  if (age < u.days) return null;
  if (u.remindedAt && now.getTime() - u.remindedAt.getTime() < REMINDER_REPEAT_DAYS * DAY) return null;
  return age;
}
