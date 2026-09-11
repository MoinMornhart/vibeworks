import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { removeUploadFile } from "@/lib/uploads";
import { appLink, notifyUser } from "@/lib/notify";
import { translateMessage } from "@/lib/i18n/messages";
import { checkSite, sslExpiry } from "./check";
import { nextLiveState, sslStep, type LiveState } from "./logic";

// Eine Runde der Live-Überwachung: jede eingetragene Seite abrufen, die
// Prüfung speichern, Zustand und Benachrichtigungen fortschreiben. SSL wird
// alle 12 Stunden gelesen.

const DAY = 86_400_000;
const SSL_EVERY_MS = 12 * 3_600_000;
const KEEP_MS = 30 * DAY;
const PARALLEL = 4;

export async function dropUpload(uploadId: string | null) {
  if (!uploadId) return;
  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return;
  await db.upload.delete({ where: { id: upload.id } }).catch(() => undefined);
  await removeUploadFile(upload.id, upload.ext);
}

/** Andere Live-Adresse: Messungen, Zertifikat und Titelbild gehören zur alten Seite. */
export async function resetLive(projectId: string, coverUploadId: string | null) {
  await db.uptimeCheck.deleteMany({ where: { projectId } });
  await db.$executeRaw`UPDATE "Project" SET "liveState" = NULL, "liveFails" = 0, "liveMs" = NULL, "liveError" = NULL, "liveSince" = NULL, "liveCheckedAt" = NULL, "sslExpiresAt" = NULL, "sslCheckedAt" = NULL, "sslNotified" = NULL, "coverUploadId" = NULL, "coverCheckedAt" = NULL WHERE "id" = ${projectId}`;
  await dropUpload(coverUploadId);
}

async function checkProject(projectId: string): Promise<void> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      updatedAt: true,
      liveUrl: true,
      liveState: true,
      liveFails: true,
      sslCheckedAt: true,
      sslNotified: true,
      coverUploadId: true,
      coverCheckedAt: true,
    },
  });
  if (!p?.liveUrl) return;
  const liveUrl = p.liveUrl;
  const now = new Date();
  const result = await checkSite(liveUrl);
  const next = nextLiveState({ state: (p.liveState as LiveState | null) ?? null, fails: p.liveFails }, result.ok);

  // updatedAt bewusst beibehalten – eine Prüfung ist keine Änderung am Projekt
  const data: Prisma.ProjectUncheckedUpdateInput = {
    updatedAt: p.updatedAt,
    liveState: next.state,
    liveFails: next.fails,
    liveMs: result.ms,
    liveError: result.error,
    liveCheckedAt: now,
  };
  if (next.state !== p.liveState) data.liveSince = now;

  let sslWarn: number | null = null;
  if (result.ok && liveUrl.startsWith("https:") && (!p.sslCheckedAt || now.getTime() - p.sslCheckedAt.getTime() > SSL_EVERY_MS)) {
    const expires = await sslExpiry(liveUrl).catch(() => null);
    data.sslCheckedAt = now;
    data.sslExpiresAt = expires;
    if (expires) {
      const days = Math.floor((expires.getTime() - now.getTime()) / DAY);
      const step = sslStep(days, p.sslNotified);
      data.sslNotified = step.notified;
      if (step.notify) sslWarn = Math.max(days, 0);
    }
  }

  // Titelbilder auf den Karten gibt es nicht mehr – ein früher geholtes aufräumen
  if (p.coverUploadId) {
    data.coverUploadId = null;
    await dropUpload(p.coverUploadId);
  }

  await db.$transaction([
    db.uptimeCheck.create({ data: { projectId, ok: result.ok, status: result.status, ms: result.ms, error: result.error } }),
    db.project.update({ where: { id: projectId }, data }),
  ]);

  const link = appLink(`/projects/${projectId}`);
  if (next.event === "down") {
    void notifyUser(p.ownerId, "siteDown", (t, locale) => ({
      event: "siteDown",
      title: t("events.siteDown.title", { project: p.name }),
      message: t("events.siteDown.message", { url: liveUrl, error: translateMessage(locale, result.error ?? "") }),
      url: link,
      priority: "high",
    }));
  } else if (next.event === "up") {
    void notifyUser(p.ownerId, "siteDown", (t) => ({
      event: "siteDown",
      title: t("events.siteUp.title", { project: p.name }),
      message: t("events.siteUp.message", { url: liveUrl, ms: result.ms ?? 0 }),
      url: link,
    }));
  }
  if (sslWarn !== null) {
    const host = new URL(liveUrl).hostname;
    void notifyUser(p.ownerId, "siteDown", (t) => ({
      event: "siteDown",
      title: t("events.sslExpiring.title", { project: p.name }),
      message: t("events.sslExpiring.message", { host, n: sslWarn }),
      url: link,
      priority: "high",
    }));
  }
}

// Je Projekt nur eine Prüfung gleichzeitig (Takt und „Jetzt prüfen“)
const running = new Map<string, Promise<void>>();

export function checkProjectNow(projectId: string): Promise<void> {
  const active = running.get(projectId);
  if (active) return active;
  const job = checkProject(projectId)
    .catch((err) => console.error(`[monitor] Projekt ${projectId}:`, err))
    .finally(() => running.delete(projectId));
  running.set(projectId, job);
  return job;
}

export async function runMonitorOnce(): Promise<number> {
  const projects = await db.project.findMany({ where: { liveUrl: { not: null }, status: { not: "ARCHIVED" } }, select: { id: true } });
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, projects.length) }, async () => {
      while (index < projects.length) await checkProjectNow(projects[index++].id);
    }),
  );
  await db.uptimeCheck.deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_MS) } } });
  return projects.length;
}
