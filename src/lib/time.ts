// Zeiterfassung ohne Datenbank: Dauer eines Eintrags, Anzeige, Fokus-Rest.

/** Ein vergessener Timer zählt höchstens so lange. */
export const MAX_ENTRY_SECONDS = 12 * 3600;
export const FOCUS_MINUTES = 25;

export function entrySeconds(startedAt: Date | string, endedAt: Date | string | null, now: Date = new Date()): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  return Math.max(0, Math.min(MAX_ENTRY_SECONDS, Math.round((end - start) / 1000)));
}

/** „2 h 05 min“, „12 min“, „40 s“ – kurz und ohne Übersetzung verständlich. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Laufende Uhr „1:02:03“ bzw. „12:34“. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Fokus-Timer: verbleibende Sekunden (negativ = vorbei). */
export function focusRemaining(startedAt: Date | string, focusMinutes: number, now: Date = new Date()): number {
  return Math.round((new Date(startedAt).getTime() + focusMinutes * 60_000 - now.getTime()) / 1000);
}
