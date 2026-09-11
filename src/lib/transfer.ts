import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dayKey, normalizeTags } from "@/lib/utils";
import { dayKeyToDate } from "@/lib/taskDates";
import { PROJECT_ACCENTS } from "@/lib/status";
import { TASK_ORDER } from "@/lib/tasks";
import { nextPosition, uniqueSlug } from "@/lib/projects";
import { nextDocPosition } from "@/lib/docs";
import { CHANGELOG } from "@/lib/changelog";
import { EXPORT_FORMAT, EXPORT_VERSION, orderDocs, type ImportData } from "@/lib/transferSchema";

// Export als JSON und Import daraus. Enthalten sind Projekte mit Aufgaben und
// Notizen sowie Docs – nie Tokens, Webhook-Geheimnisse, Teilen-Links oder
// Mitglieder. Ein Import legt immer neu an und überschreibt nichts.

export async function exportData(opts: { projectWhere: Prisma.ProjectWhereInput; docsOwnerId: string | null }) {
  const projects = await db.project.findMany({
    where: opts.projectWhere,
    orderBy: { createdAt: "asc" },
    include: { tasks: { orderBy: TASK_ORDER }, notes: { orderBy: { createdAt: "asc" } } },
  });
  const docs = opts.docsOwnerId ? await db.doc.findMany({ where: { ownerId: opts.docsOwnerId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }) : [];
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    app: CHANGELOG[0]?.version ?? null,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => ({
      name: p.name,
      summary: p.summary,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      accent: p.accent,
      tags: p.tags,
      favorite: p.favorite,
      progressFromTasks: p.progressFromTasks,
      repoUrl: p.repoUrl,
      tasks: p.tasks.map((t) => ({
        title: t.title,
        description: t.description,
        status: t.status,
        labels: t.labels,
        recurrence: t.recurrence,
        dueDate: t.dueDate ? dayKey(t.dueDate) : null,
        doneAt: t.doneAt?.toISOString() ?? null,
      })),
      notes: p.notes.map((n) => ({ title: n.title, content: n.content, pinned: n.pinned, createdAt: n.createdAt.toISOString() })),
    })),
    docs: docs.map((d) => ({
      ref: d.id,
      parentRef: d.parentId,
      kind: d.kind,
      title: d.title,
      icon: d.icon,
      content: d.content,
      sourceUrl: d.sourceUrl,
      archive: d.archive,
      pinned: d.pinned,
      position: d.position,
    })),
  };
}

export function downloadResponse(data: unknown, filename: string): NextResponse {
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "cache-control": "no-store",
    },
  });
}

export interface ImportCounts {
  projects: number;
  tasks: number;
  notes: number;
  docs: number;
}

export async function importData(ownerId: string, data: ImportData): Promise<ImportCounts> {
  const counts: ImportCounts = { projects: 0, tasks: 0, notes: 0, docs: 0 };

  for (const p of data.projects) {
    const project = await db.project.create({
      data: {
        ownerId,
        name: p.name,
        slug: await uniqueSlug(ownerId, p.name),
        summary: p.summary?.trim() || null,
        description: p.description?.trim() || null,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        accent: PROJECT_ACCENTS[p.accent] ? p.accent : "violet",
        tags: normalizeTags(p.tags),
        favorite: p.favorite,
        progressFromTasks: p.progressFromTasks,
        repoUrl: p.repoUrl || null,
        position: await nextPosition(ownerId, p.status),
      },
      select: { id: true },
    });
    counts.projects++;

    const positions: Partial<Record<string, number>> = {};
    if (p.tasks.length) {
      await db.task.createMany({
        data: p.tasks.map((t) => {
          const position = (positions[t.status] = (positions[t.status] ?? -1) + 1);
          const done = t.status === "DONE";
          const doneAt = done ? (t.doneAt ? new Date(t.doneAt) : new Date()) : null;
          return {
            projectId: project.id,
            title: t.title,
            description: t.description?.trim() || null,
            status: t.status,
            position,
            labels: normalizeTags(t.labels, 8),
            recurrence: t.recurrence ?? null,
            dueDate: t.dueDate ? dayKeyToDate(t.dueDate) : null,
            doneAt,
            statusChangedAt: doneAt ?? new Date(),
          };
        }),
      });
      counts.tasks += p.tasks.length;
    }
    if (p.notes.length) {
      await db.note.createMany({
        data: p.notes.map((n) => ({ projectId: project.id, title: n.title?.trim() || null, content: n.content, pinned: n.pinned, ...(n.createdAt ? { createdAt: new Date(n.createdAt) } : {}) })),
      });
      counts.notes += p.notes.length;
    }
  }

  // Seiten: Eltern zuerst, damit jede Seite ihren neuen Elternteil schon kennt.
  const ids = new Map<string, string>();
  const rootOffset = await nextDocPosition(ownerId, null);
  for (const d of orderDocs(data.docs)) {
    const parentId = d.parentRef ? (ids.get(d.parentRef) ?? null) : null;
    const created = await db.doc.create({
      data: {
        ownerId,
        parentId,
        kind: d.kind,
        title: d.title,
        icon: d.icon || null,
        content: d.content,
        sourceUrl: d.sourceUrl || null,
        archive: d.archive || null,
        pinned: d.pinned,
        position: parentId ? d.position : rootOffset + d.position,
      },
      select: { id: true },
    });
    ids.set(d.ref, created.id);
    counts.docs++;
  }
  return counts;
}
