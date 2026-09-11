import { TIME_ZONE } from "@/lib/utils";

// Wochen rechnen auf Kalendertagen ("YYYY-MM-DD") in Europe/Berlin – eine
// Woche beginnt am Montag. Ohne Datenbank, also auch im Browser nutzbar.

const parse = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDaysKey(key: string, days: number): string {
  return format(parse(key) + days * 86_400_000);
}

/** Montag der Woche, in der der Tag liegt. */
export function mondayOf(key: string): string {
  const weekday = (new Date(parse(key)).getUTCDay() + 6) % 7; // Mo = 0 … So = 6
  return addDaysKey(key, -weekday);
}

/** Kalenderwoche nach ISO 8601 (die Woche mit dem ersten Donnerstag ist KW 1). */
export function isoWeek(key: string): number {
  const d = new Date(parse(key));
  const thursday = parse(key) + (3 - ((d.getUTCDay() + 6) % 7)) * 86_400_000;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - yearStart) / 86_400_000 / 7) + 1;
}

/** Abstand der Zeitzone zu UTC in Minuten zu einem Zeitpunkt (Sommerzeit beachtet). */
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - at.getTime()) / 60_000;
}

/** Mitternacht dieses Tages in Europe/Berlin als Zeitpunkt. */
export function zonedMidnight(key: string): Date {
  const utc = parse(key);
  const first = utc - zoneOffsetMinutes(new Date(utc)) * 60_000;
  // Zweiter Schritt, falls die Umstellung genau dazwischen liegt
  return new Date(utc - zoneOffsetMinutes(new Date(first)) * 60_000);
}
