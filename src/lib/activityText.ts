import type { ActivityKind, ProjectStatus, TaskStatus } from "@prisma/client";
import type { TFunction } from "@/lib/i18n/messages";

// Verlaufseinträge in der Sprache der Oberfläche. Neue Einträge tragen in
// `meta` alles Nötige (Titel, Status, Aktion); ältere ohne diese Angaben
// erscheinen mit ihrem gespeicherten Text.

const PROJECT_STATUSES = ["IDEA", "PLANNING", "OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"] as const;
const TASK_STATUSES = ["TODO", "DOING", "BLOCKED", "DONE"] as const;
const isProjectStatus = (v: unknown): v is ProjectStatus => typeof v === "string" && (PROJECT_STATUSES as readonly string[]).includes(v);
const isTaskStatus = (v: unknown): v is TaskStatus => typeof v === "string" && (TASK_STATUSES as readonly string[]).includes(v);

export interface ActivityLike {
  kind: ActivityKind;
  summary: string;
  meta: unknown;
}

/** Feinere Art für Symbol und Farbe – z. B. „erledigt“ statt nur „verschoben“. */
export type FeedKind = ActivityKind | "TASK_DONE" | "SHARE" | "COMMIT";

export function feedKind(a: ActivityLike): FeedKind {
  const m = (a.meta ?? {}) as Record<string, unknown>;
  if (a.kind === "TASK_MOVED" && m.to === "DONE") return "TASK_DONE";
  if (a.kind === "PROJECT_UPDATED" && typeof m.action === "string") return "SHARE";
  return a.kind;
}

export function activityText(a: ActivityLike, t: TFunction<"review">, ts: TFunction<"status">): string {
  const m = (a.meta ?? {}) as Record<string, unknown>;
  const title = typeof m.title === "string" ? m.title : null;
  switch (a.kind) {
    case "PROJECT_CREATED":
      return t("activity.projectCreated");
    case "STATUS_CHANGED":
      if (isProjectStatus(m.from) && isProjectStatus(m.to)) return t("activity.statusChanged", { from: ts(`project.${m.from}`), to: ts(`project.${m.to}`) });
      break;
    case "TASK_MOVED":
      if (title && m.to === "DONE") return t("activity.taskDone", { title });
      if (title && isTaskStatus(m.from) && isTaskStatus(m.to)) return t("activity.taskMoved", { title, from: ts(`task.${m.from}`), to: ts(`task.${m.to}`) });
      break;
    case "TASK_ADDED":
      if (title) return t("activity.taskAdded", { title });
      break;
    case "TASK_DELETED":
      if (title) return t("activity.taskDeleted", { title });
      break;
    case "NOTE_ADDED":
      if (title) return t("activity.noteAdded", { title });
      break;
    case "NOTE_UPDATED":
      if (title) return t("activity.noteUpdated", { title });
      break;
    case "NOTE_DELETED":
      if (title) return t("activity.noteDeleted", { title });
      break;
    case "PROJECT_UPDATED":
      if (m.action === "shareOn" || m.action === "shareOff" || m.action === "shareRenew") return t(`activity.${m.action}`);
      if ((m.action === "requestApproved" || m.action === "requestDenied") && typeof m.username === "string") return t(`activity.${m.action}`, { username: m.username });
      if (Array.isArray(m.fields)) return t("activity.projectEdited");
      break;
  }
  return a.summary;
}
