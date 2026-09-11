import type { ProjectStatus } from "@prisma/client";

// Projekt-Friedhof: Projekte, die lange schlafen, schlägt das Dashboard zum
// Begraben vor. Begraben heißt archivieren mit Grabstein – nichts geht
// verloren, Wiederbeleben stellt den alten Status wieder her.

export const SLEEP_DAYS = 30;
export const SNOOZE_DAYS = 30;
export const AWAKE_STATUSES: ProjectStatus[] = ["IDEA", "PLANNING", "OPEN", "IN_PROGRESS"];
export const CAUSES = ["time", "better", "complex", "done", "motivation", "other"] as const;
export type Cause = (typeof CAUSES)[number];

export const isCause = (v: unknown): v is Cause => typeof v === "string" && (CAUSES as readonly string[]).includes(v);

/** Letztes Lebenszeichen: Änderung in VibeWorks oder jüngster Commit, was später war. */
export function lastSign(updatedAt: Date, commits: unknown): Date {
  let last = updatedAt.getTime();
  if (Array.isArray(commits)) {
    for (const c of commits) {
      const t = Date.parse((c as { date?: string } | null)?.date ?? "");
      if (!Number.isNaN(t) && t > last) last = t;
    }
  }
  return new Date(last);
}

/** Lebensdauer in Tagen – mindestens einer. */
export function lifespanDays(from: Date | string, to: Date | string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}
