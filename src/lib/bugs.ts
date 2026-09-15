import { Prisma, type AppError } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { appLink, notifyUser } from "@/lib/notify";
import { hit, MINUTE } from "@/lib/security/rateLimit";
import { fingerprintSource, MAX_GROUPS, type ErrorReport, type ErrorStatus } from "./bugsLogic";

// Fehler-Eingang: Berichte zusammenfassen (je Fingerabdruck eine Zeile mit
// Zähler), neue und wiederkehrende Fehler melden. Die Details sehen nur
// Projektmitglieder.

/** Öffentliche Adresse, an die eine App ihre Fehler schickt. */
export const errorEndpoint = (key: string) => `${config.appUrl}/api/errors/in/${key}`;

type IngestProject = { id: string; name: string; ownerId: string };
export type IngestResult = "new" | "again" | "regression" | "ignored" | "full";

export async function ingestError(project: IngestProject, report: ErrorReport, userAgent: string | null, retry = true): Promise<IngestResult> {
  const fingerprint = sha256(fingerprintSource(report));
  const now = new Date();
  const existing = await db.appError.findUnique({ where: { projectId_fingerprint: { projectId: project.id, fingerprint } } });
  if (existing) {
    const back = existing.status === "resolved";
    await db.appError.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        lastSeen: now,
        stack: report.stack ?? existing.stack,
        url: report.url ?? existing.url,
        release: report.release ?? existing.release,
        environment: report.environment ?? existing.environment,
        userAgent: userAgent ?? existing.userAgent,
        ...(back ? { status: "open", resolvedAt: null } : {}),
      },
    });
    if (back) void notifyAppError(project, report, true);
    return existing.status === "ignored" ? "ignored" : back ? "regression" : "again";
  }
  if ((await db.appError.count({ where: { projectId: project.id } })) >= MAX_GROUPS) return "full";
  try {
    await db.appError.create({ data: { projectId: project.id, fingerprint, ...report, userAgent } });
  } catch (err) {
    // Derselbe Fehler kam gleichzeitig zweimal an – dann eben mitzählen
    if (retry && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return ingestError(project, report, userAgent, false);
    throw err;
  }
  void notifyAppError(project, report, false);
  return "new";
}

async function notifyAppError(project: IngestProject, report: ErrorReport, regression: boolean): Promise<void> {
  // Höchstens 5 Meldungen je Projekt und Stunde – ein kaputtes Release soll nicht das Handy fluten
  if (!hit(`app-error-notify:${project.id}`, 5, 60 * MINUTE).ok) return;
  await notifyUser(project.ownerId, "appError", (t) => ({
    event: "appError",
    title: t(regression ? "events.appError.regression" : "events.appError.title", { project: project.name }),
    message: `${report.type ? `${report.type}: ` : ""}${report.message}`.slice(0, 300),
    url: appLink(`/projects/${project.id}#fehler`),
    priority: "urgent",
  })).catch((err) => console.error("[errors-in]", project.id, err));
}

export function setErrorStatus(id: string, status: ErrorStatus) {
  return db.appError.update({ where: { id }, data: { status, resolvedAt: status === "resolved" ? new Date() : null } });
}

export const loadErrors = (projectId: string) => db.appError.findMany({ where: { projectId }, orderBy: { lastSeen: "desc" }, take: 300 });

export function serializeAppError(e: AppError) {
  return {
    id: e.id,
    type: e.type,
    message: e.message,
    stack: e.stack,
    url: e.url,
    release: e.release,
    environment: e.environment,
    userAgent: e.userAgent,
    count: e.count,
    status: e.status as ErrorStatus,
    firstSeen: e.firstSeen.toISOString(),
    lastSeen: e.lastSeen.toISOString(),
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
    taskId: e.taskId,
  };
}
export type AppErrorItem = ReturnType<typeof serializeAppError>;
