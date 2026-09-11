import type { Prisma, Task } from "@prisma/client";
import type { z } from "zod";
import { after } from "next/server";
import { db } from "./db";
import { pushTaskIssue, pushTaskIssues } from "./git/issues";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "./tasks";
import { dayKeyToDate } from "./taskDates";
import { noteLabel, touchProject } from "./notes";
import { logActivity } from "./activity";
import { truncate } from "./utils";
import { accessOf, canAccess } from "./access";
import type { noteCreateSchema, taskCreateSchema, taskUpdateSchema } from "./validation";

// Schreibvorgänge mit allen Folgen – Verlauf, Fortschritt, Issue-Spiegelung.
// Gemeinsam für die Oberfläche (API-Routen) und Claude (MCP). Die Rechte
// prüft der Aufrufer vorher.

export async function createTask(userId: string, projectId: string, input: z.output<typeof taskCreateSchema>) {
  const task = await db.task.create({
    data: {
      ...input,
      dueDate: input.dueDate ? dayKeyToDate(input.dueDate) : null,
      doneAt: input.status === "DONE" ? new Date() : null,
      projectId,
      position: await nextTaskPosition(db, projectId, input.status),
    },
  });
  await logActivity({ projectId, userId, kind: "TASK_ADDED", summary: `Aufgabe „${truncate(task.title, 60)}“ angelegt`, meta: { title: truncate(task.title, 60), taskId: task.id } });
  await touchProject(projectId);
  const progress = await syncProjectProgress(projectId);
  after(() => pushTaskIssue(task.id));
  return { task, progress };
}

export async function updateTask(userId: string, current: Task, input: z.output<typeof taskUpdateSchema>) {
  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.labels !== undefined) data.labels = input.labels;
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? dayKeyToDate(input.dueDate) : null;

  let result: { task: Task; spawned: Task | null };
  if (input.status !== undefined && input.status !== current.status) {
    // Beim Spaltenwechsel ans Ende der neuen Spalte
    data.position = await nextTaskPosition(db, current.projectId, input.status);
    result = await db.$transaction((tx) => transitionTask(tx, current, input.status!, userId, data));
  } else {
    result = { task: await db.task.update({ where: { id: current.id }, data }), spawned: null };
  }

  await touchProject(current.projectId);
  const progress = await syncProjectProgress(current.projectId);
  const pushIds = [result.task.id, ...(result.spawned ? [result.spawned.id] : [])];
  after(() => pushTaskIssues(pushIds));
  return { ...result, progress };
}

export async function createNote(userId: string, projectId: string, input: z.output<typeof noteCreateSchema>) {
  const note = await db.note.create({ data: { ...input, projectId } });
  await touchProject(projectId);
  await logActivity({ projectId, userId, kind: "NOTE_ADDED", summary: `Notiz „${noteLabel(note)}“ hinzugefügt`, meta: { title: noteLabel(note) } });
  await syncProjectProgress(projectId); // Notizen zählen zur Planung
  return note;
}

/**
 * Dieselbe Aufgabe in mehreren Projekten anlegen – z. B. „Abhängigkeiten
 * aktualisieren“ für alle Projekte mit Git. Projekte ohne Schreibrecht werden
 * übersprungen. Issues entstehen wie gewohnt je Projekt.
 */
export async function createTaskInProjects(
  userId: string,
  projectIds: string[],
  input: Pick<z.output<typeof taskCreateSchema>, "title" | "description" | "dueDate" | "labels">,
) {
  const created: Array<{ task: Task; project: { id: string; name: string; accent: string } }> = [];
  let skipped = 0;
  for (const id of [...new Set(projectIds)]) {
    const res = await accessOf(userId, id);
    if (!res || !canAccess(res.access, "EDITOR") || res.project.status === "ARCHIVED") {
      skipped++;
      continue;
    }
    const { task } = await createTask(userId, id, { ...input, status: "TODO", recurrence: null });
    created.push({ task, project: { id, name: res.project.name, accent: res.project.accent } });
  }
  return { created, skipped };
}
