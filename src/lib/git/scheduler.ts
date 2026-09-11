import { db } from "@/lib/db";
import { syncProjectRepository } from "./sync";
import { syncIssues } from "./issues";
import { tokenCipherFor } from "./token";

// Hintergrund-Abgleich: in festem Takt Commits und Issues aller Projekte, die
// einen Zugang haben (Projekt-Token oder Git-Verbindung des Besitzers). So
// wandert eine Aufgabe nach „In Arbeit“ oder „Erledigt“, auch wenn gerade
// niemand VibeWorks offen hat. Projekte ohne Token gleichen weiter nur beim
// Öffnen ab – ohne Anmeldung erlaubt GitHub nur 60 Anfragen pro Stunde.
//
// GIT_SYNC_INTERVAL_MIN – Takt in Minuten (Standard 5)
// GIT_SYNC_DISABLED=true – Hintergrund-Abgleich abschalten

const INTERVAL_MS = Math.max(1, Number(process.env.GIT_SYNC_INTERVAL_MIN) || 5) * 60_000;
// Was gerade erst (etwa von der offenen Projektseite) abgeglichen wurde, bleibt diesmal liegen.
const FRESH_MS = Math.max(30_000, INTERVAL_MS - 30_000);

interface SchedulerState {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
}
const g = globalThis as typeof globalThis & { __vwGitScheduler?: SchedulerState };

export async function runGitSyncOnce(): Promise<{ synced: number; skipped: number }> {
  const projects = await db.project.findMany({
    where: { repoUrl: { not: null }, status: { not: "ARCHIVED" } },
    select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, repoCache: { select: { fetchedAt: true } } },
  });
  let synced = 0;
  let skipped = 0;
  for (const project of projects) {
    const fresh = project.repoCache && Date.now() - project.repoCache.fetchedAt.getTime() < FRESH_MS;
    if (fresh || !(await tokenCipherFor(project))) {
      skipped++;
      continue;
    }
    try {
      const cache = await syncProjectRepository(project);
      if (!cache.error) await syncIssues(project.id);
      synced++;
    } catch (err) {
      console.error(`[git-sync] Projekt ${project.id}:`, err);
    }
  }
  return { synced, skipped };
}

// Sofort-Abgleich (Webhook): läuft je Projekt nur einmal gleichzeitig; kommt
// währenddessen noch ein Webhook, folgt genau ein weiterer Durchgang.
const inFlight = new Map<string, { rerun: boolean; job: Promise<void> }>();

export function syncProjectNow(projectId: string): Promise<void> {
  const current = inFlight.get(projectId);
  if (current) {
    current.rerun = true;
    return current.job;
  }
  const entry = { rerun: false, job: Promise.resolve() };
  entry.job = (async () => {
    do {
      entry.rerun = false;
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true } });
      if (!project?.repoUrl) break;
      const cache = await syncProjectRepository(project);
      if (!cache.error) await syncIssues(project.id);
    } while (entry.rerun);
  })()
    .catch((err) => console.error(`[git-sync] Webhook ${projectId}:`, err))
    .finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, entry);
  return entry.job;
}

/** Startet den Takt genau einmal je Serverprozess. */
export function startGitScheduler() {
  if (process.env.GIT_SYNC_DISABLED === "true") return;
  const state = (g.__vwGitScheduler ??= { running: false });
  if (state.timer) return;

  const tick = async () => {
    if (state.running) return; // ein langsamer Lauf überholt sich nicht selbst
    state.running = true;
    try {
      await runGitSyncOnce();
    } catch (err) {
      console.error("[git-sync]", err);
    } finally {
      state.running = false;
    }
  };

  state.timer = setInterval(() => void tick(), INTERVAL_MS);
  state.timer.unref?.();
  // Kurz nach dem Start einmal – nach einem Update sind die Spalten gleich aktuell.
  setTimeout(() => void tick(), 20_000).unref?.();
}
