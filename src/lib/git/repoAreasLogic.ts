import { tk } from "@/lib/i18n/messages";

// Bereiche eines verknüpften Repositories (#66): was läuft, was ist
// eingeschränkt – ohne Datenbank. Eine Einschränkung (z. B. abgeschaltete
// Issues) heißt nicht, dass das Repository kaputt ist.

/** Nach „Issues abgeschaltet“ erst nach dieser Zeit wieder anfragen. */
export const ISSUES_RETRY_MS = 24 * 60 * 60_000;

export function issuesPaused(offAt: Date | null | undefined, now: number = Date.now()): boolean {
  return Boolean(offAt && now - offAt.getTime() < ISSUES_RETRY_MS);
}

export type AreaState = "ok" | "limited" | "off" | "error";
export interface RepoArea {
  area: "commits" | "issues" | "ci" | "deps";
  state: AreaState;
  /** Übersetzungsschlüssel oder gespeicherte Meldung – beim Anzeigen übersetzen */
  note: string | null;
}

export function repoAreas(input: {
  provider: string | null;
  cacheError: string | null;
  hasCommits: boolean;
  issueSync: boolean;
  issuesOffAt: Date | null;
  ci: { state?: string } | null;
  deps: { error?: string | null; manifest?: string | null } | null;
}): RepoArea[] {
  const areas: RepoArea[] = [
    { area: "commits", state: input.cacheError ? (input.hasCommits ? "limited" : "error") : "ok", note: input.cacheError },
  ];
  if (input.provider && input.provider !== "git") {
    areas.push({
      area: "issues",
      state: !input.issueSync ? "off" : input.issuesOffAt ? "limited" : "ok",
      note: !input.issueSync ? tk("git", "areas.issuesSyncOff") : input.issuesOffAt ? tk("git", "areas.issuesDisabled") : null,
    });
    areas.push({ area: "ci", state: input.ci ? (input.ci.state === "failure" ? "error" : "ok") : "off", note: input.ci ? null : tk("git", "areas.noCi") });
  }
  areas.push({
    area: "deps",
    state: !input.deps ? "off" : input.deps.error ? "limited" : input.deps.manifest ? "ok" : "off",
    note: !input.deps ? tk("git", "areas.depsPending") : (input.deps.error ?? (input.deps.manifest ? null : tk("git", "areas.noManifest"))),
  });
  return areas;
}
