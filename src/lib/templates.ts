import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { NOTE_ORDER } from "@/lib/notes";
import { nextTaskPosition, syncProjectProgress, TASK_ORDER } from "@/lib/tasks";
import { builtinTemplates, templateDataSchema, type TemplateData, type TemplateView } from "@/lib/templateData";

// Projektvorlagen mit Datenbank: eigene Vorlagen speichern, auflösen und auf
// ein neues Projekt anwenden.

export const MAX_OWN_TEMPLATES = 100;

function parseData(json: Prisma.JsonValue): TemplateData {
  const parsed = templateDataSchema.safeParse(json);
  return parsed.success ? parsed.data : { tasks: [], notes: [] };
}

export async function listTemplates(userId: string, locale: Locale): Promise<{ builtin: TemplateView[]; own: TemplateView[] }> {
  const own = await db.projectTemplate.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } });
  return {
    builtin: builtinTemplates(locale),
    own: own.map((t) => ({ id: t.id, kind: "own", name: t.name, description: t.description, data: parseData(t.data) })),
  };
}

/** "builtin:web" oder die ID einer eigenen Vorlage; null, wenn es sie nicht gibt. */
export async function resolveTemplate(userId: string, locale: Locale, id: string): Promise<TemplateData | null> {
  if (id.startsWith("builtin:")) return builtinTemplates(locale).find((t) => t.id === id)?.data ?? null;
  const own = await db.projectTemplate.findFirst({ where: { id, ownerId: userId } });
  return own ? parseData(own.data) : null;
}

/** Momentaufnahme eines Projekts als Vorlage – ohne Status, Fälligkeiten und Repository. */
export async function snapshotProject(projectId: string): Promise<TemplateData> {
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      summary: true,
      description: true,
      accent: true,
      tags: true,
      priority: true,
      progressFromTasks: true,
      tasks: { orderBy: TASK_ORDER, take: 500, select: { title: true, description: true, labels: true } },
      notes: { orderBy: NOTE_ORDER, take: 200, select: { title: true, content: true, pinned: true } },
    },
  });
  return {
    summary: p.summary,
    description: p.description,
    accent: p.accent,
    tags: p.tags,
    priority: p.priority,
    progressFromTasks: p.progressFromTasks,
    tasks: p.tasks.map((t) => ({ title: t.title, description: t.description, labels: t.labels })),
    notes: p.notes.map((n) => ({ title: n.title, content: n.content, pinned: n.pinned })),
  };
}

/** Aufgaben und Notizen einer Vorlage in ein Projekt übernehmen. */
export async function applyTemplate(projectId: string, data: TemplateData): Promise<void> {
  let position = await nextTaskPosition(db, projectId, "TODO");
  if (data.tasks.length) {
    await db.task.createMany({
      data: data.tasks.map((t) => ({ projectId, title: t.title, description: t.description ?? null, labels: t.labels ?? [], status: "TODO" as const, position: position++ })),
    });
  }
  if (data.notes.length) {
    await db.note.createMany({ data: data.notes.map((n) => ({ projectId, title: n.title ?? null, content: n.content, pinned: n.pinned ?? false })) });
  }
  await syncProjectProgress(projectId);
}
