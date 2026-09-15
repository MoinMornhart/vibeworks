import { z } from "zod";
import type { Prisma, Task } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/api";
import { accessOf, canAccess, requireNote, requireTask, visibleTo, type ProjectAccess } from "@/lib/access";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { docCreateSchema, docUpdateSchema, noteCreateSchema, projectUpdateSchema, taskBulkSchema, taskCreateSchema, taskUpdateSchema } from "@/lib/validation";
import { createNote, createTask, createTaskInProjects, updateTask } from "@/lib/actions";
import { searchContent } from "@/lib/searchQuery";
import { HIT_END, HIT_START } from "@/lib/search";
import { findOwnDoc, loadTree, nextDocPosition } from "@/lib/docs";
import { nextPosition } from "@/lib/projects";
import { syncProjectProgress, TASK_ORDER } from "@/lib/tasks";
import { NOTE_ORDER, noteLabel } from "@/lib/notes";
import { logActivity } from "@/lib/activity";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { dayKeyToDate } from "@/lib/taskDates";
import { addDaysKey } from "@/lib/weeks";
import { dayKey, slugify, truncate } from "@/lib/utils";
import { config } from "@/lib/config";
import type { PromptProvider, ResourceProvider, ToolDef } from "./protocol";
import type { Locale } from "@/lib/i18n/config";
import { claudeMdFor } from "@/lib/claudeMdServer";
import { fillPrompt } from "@/lib/prompts";
import { protectedChanges } from "@/lib/protect";
import { currentEntry, stopRunning } from "@/lib/timeServer";
import { MAX_FOCUS } from "@/lib/today";

// Die Werkzeuge, die Claude Code über MCP sieht. Beschreibungen auf Englisch
// (sie richten sich an das Modell), Inhalte so, wie sie gespeichert sind.
// Jedes Werkzeug prüft die Rechte wie die Oberfläche: Lesen ab Betrachter,
// Schreiben ab Bearbeiter, Docs gehören allein dem Konto.

export interface McpContext {
  userId: string;
  locale: Locale;
}

export const MCP_INSTRUCTIONS = [
  "VibeWorks is the user's self-hosted project control center.",
  "Projects have a status (IDEA → PLANNING → OPEN → IN_PROGRESS → DONE, or ARCHIVED), a priority (1 low – 4 critical) and a progress in percent.",
  "Each project has a task board (TODO, DOING, BLOCKED, DONE) and notes; docs are the user's personal page tree.",
  "Refer to projects by id or by their exact name.",
  "Working on tasks: find them with list_tasks or get_project, set status DOING when you start, DONE when finished (BLOCKED with a short reason in the description if you are stuck).",
  "If a project mirrors tasks as issues in its Git repository, the issues follow automatically.",
  "Everything you change shows up in the project's activity log under the user's name – keep titles short and clear.",
  "To see what is broken (sync errors, red CI, sites down, vulnerable dependencies, overdue or blocked tasks) use list_problems; for one project's repository, CI, dependencies and live site use get_repo_status.",
  "The user's day: get_today shows planned tasks and suggestions, add_to_today/remove_from_today plan it, start_timer/stop_timer track time on a task.",
  "Starred projects are protected: their status and repository can't be changed via MCP – ask the user to do it in VibeWorks.",
].join(" ");

const PROJECT_STATUSES = ["IDEA", "PLANNING", "OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"] as const;
const TASK_STATUSES = ["TODO", "DOING", "BLOCKED", "DONE"] as const;
const RECURRENCES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

const ref = z.string().trim().min(1).max(200);
const link = (path: string) => `${config.appUrl}${path}`;
const DAY = 86_400_000;
const MAX_TEXT = 200_000;

/** Projekt per ID, exaktem Namen oder Slug – mit Rechteprüfung. */
async function resolveProject(userId: string, value: string, min: ProjectAccess = "VIEWER") {
  let res = await accessOf(userId, value);
  if (!res) {
    const matches = await db.project.findMany({
      where: { AND: [visibleTo(userId), { OR: [{ name: { equals: value, mode: "insensitive" } }, { slug: value.toLowerCase() }] }] },
      select: { id: true },
      take: 2,
    });
    if (matches.length > 1) throw new ApiError(400, tk("mcp", "errors.ambiguous", { name: value }));
    if (matches[0]) res = await accessOf(userId, matches[0].id);
  }
  if (!res) throw notFound(tk("projects", "errors.notFound"));
  if (!canAccess(res.access, min)) throw new ApiError(403, min === "OWNER" ? tk("projects", "errors.ownerOnly") : tk("projects", "errors.viewOnly"));
  return res;
}

function taskView(t: Task, opts: { full?: boolean; project?: { id: string; name: string } } = {}) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate ? dayKey(t.dueDate) : null,
    ...(t.labels.length ? { labels: t.labels } : {}),
    ...(t.recurrence ? { recurrence: t.recurrence } : {}),
    ...(t.description ? { description: opts.full ? t.description : truncate(t.description, 500) } : {}),
    ...(t.issueUrl ? { issue: t.issueUrl } : {}),
    ...(opts.project ? { project: opts.project } : {}),
  };
}

const highlight = (s: string) => s.replaceAll(HIT_START, "**").replaceAll(HIT_END, "**");

// JSON-Schema-Bausteine für die Werkzeugbeschreibungen
const S = {
  project: { type: "string", description: "Project id or exact project name" },
  taskStatus: { type: "string", enum: TASK_STATUSES },
  dueDate: { type: ["string", "null"], description: "Due date as YYYY-MM-DD, null to clear" },
  labels: { type: "array", items: { type: "string" }, description: "Short labels, e.g. [\"bug\", \"ui\"]" },
  recurrence: { type: ["string", "null"], enum: [...RECURRENCES, null] },
};

export const MCP_TOOLS: ToolDef<McpContext>[] = [
  {
    name: "list_projects",
    title: "List projects",
    description:
      "List the user's projects (own and shared with them). Archived projects are left out unless status is ARCHIVED. Returns id, name, summary, status, priority, progress and the number of open tasks.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: PROJECT_STATUSES, description: "Only projects with this status" },
        query: { type: "string", description: "Filter by name, summary or tag" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const input = z.object({ status: z.enum(PROJECT_STATUSES).optional(), query: z.string().trim().max(100).optional() }).parse(args);
      const where: Prisma.ProjectWhereInput = {
        AND: [
          visibleTo(userId),
          input.status ? { status: input.status } : { status: { not: "ARCHIVED" } },
          input.query
            ? { OR: [{ name: { contains: input.query, mode: "insensitive" } }, { summary: { contains: input.query, mode: "insensitive" } }, { tags: { has: input.query } }] }
            : {},
        ],
      };
      const rows = await db.project.findMany({
        where,
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          summary: true,
          status: true,
          priority: true,
          progress: true,
          tags: true,
          repoUrl: true,
          ownerId: true,
          updatedAt: true,
          _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
        },
      });
      return {
        projects: rows.map((p) => ({
          id: p.id,
          name: p.name,
          summary: p.summary,
          status: p.status,
          priority: p.priority,
          progress: p.progress,
          tags: p.tags,
          openTasks: p._count.tasks,
          repoUrl: p.repoUrl,
          shared: p.ownerId !== userId,
          updatedAt: p.updatedAt.toISOString(),
        })),
      };
    },
  },
  {
    name: "get_project",
    title: "Get project",
    description:
      "Details of one project: description, repository, all open tasks (plus tasks finished in the last 14 days) and the list of notes with a short preview. Use get_note for the full text of a note.",
    inputSchema: { type: "object", properties: { project: S.project }, required: ["project"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const { project, access } = await resolveProject(userId, ref.parse(args.project));
      const [tasks, notes, repo] = await Promise.all([
        db.task.findMany({
          where: { projectId: project.id, OR: [{ status: { not: "DONE" } }, { doneAt: { gte: new Date(Date.now() - 14 * DAY) } }] },
          orderBy: TASK_ORDER,
          take: 300,
        }),
        db.note.findMany({ where: { projectId: project.id }, orderBy: NOTE_ORDER, take: 100 }),
        db.repoCache.findUnique({ where: { projectId: project.id }, select: { fullName: true, ci: true } }),
      ]);
      return {
        id: project.id,
        name: project.name,
        summary: project.summary,
        description: project.description,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        tags: project.tags,
        yourAccess: access,
        url: link(`/projects/${project.id}`),
        repository: project.repoUrl ? { url: project.repoUrl, name: repo?.fullName ?? null, ci: (repo?.ci as { state?: string } | null)?.state ?? null } : null,
        tasks: tasks.map((t) => taskView(t)),
        notes: notes.map((n) => ({ id: n.id, title: noteLabel(n), pinned: n.pinned, updatedAt: n.updatedAt.toISOString(), preview: truncate(n.content.replace(/\s+/g, " "), 200) })),
      };
    },
  },
  {
    name: "list_tasks",
    title: "List tasks",
    description:
      "Tasks across all projects (or one project), sorted by due date. By default only unfinished tasks (TODO, DOING, BLOCKED) of non-archived projects.",
    inputSchema: {
      type: "object",
      properties: {
        project: { ...S.project, description: "Only tasks of this project (id or exact name)" },
        status: { type: "array", items: S.taskStatus, description: "Only these statuses (default: everything but DONE)" },
        due: { type: "string", enum: ["overdue", "today", "week"], description: "overdue = before today, today, week = due within 7 days including overdue" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Default 100" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const input = z
        .object({
          project: ref.optional(),
          status: z.array(z.enum(TASK_STATUSES)).max(4).optional(),
          due: z.enum(["overdue", "today", "week"]).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .parse(args);
      const today = dayKey(new Date());
      const scope: Prisma.TaskWhereInput = input.project
        ? { projectId: (await resolveProject(userId, input.project)).project.id }
        : { project: { ...visibleTo(userId), status: { not: "ARCHIVED" } } };
      const due: Prisma.TaskWhereInput =
        input.due === "overdue"
          ? { dueDate: { lt: dayKeyToDate(today) } }
          : input.due === "today"
            ? { dueDate: { gte: dayKeyToDate(today), lt: dayKeyToDate(addDaysKey(today, 1)) } }
            : input.due === "week"
              ? { dueDate: { lt: dayKeyToDate(addDaysKey(today, 8)) } }
              : {};
      const tasks = await db.task.findMany({
        where: { AND: [scope, due, input.status?.length ? { status: { in: input.status } } : { status: { not: "DONE" } }] },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: input.limit,
        include: { project: { select: { id: true, name: true } } },
      });
      return { today, tasks: tasks.map((t) => taskView(t, { project: t.project })) };
    },
  },
  {
    name: "get_task",
    title: "Get task",
    description: "One task with its full description.",
    inputSchema: { type: "object", properties: { task: { type: "string", description: "Task id" } }, required: ["task"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const { task, project } = await requireTask(userId, ref.parse(args.task));
      return { ...taskView(task, { full: true, project: { id: project.id, name: project.name } }), url: link(`/projects/${project.id}`) };
    },
  },
  {
    name: "create_task",
    title: "Create task",
    description: "Create a task in a project. It lands at the end of its column; with issue sync it also becomes an issue.",
    inputSchema: {
      type: "object",
      properties: {
        project: S.project,
        title: { type: "string", maxLength: 200 },
        description: { type: "string", description: "Markdown" },
        status: { ...S.taskStatus, description: "Default TODO" },
        dueDate: S.dueDate,
        labels: S.labels,
        recurrence: S.recurrence,
      },
      required: ["project", "title"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const { project } = await resolveProject(userId, ref.parse(args.project), "EDITOR");
      const { task, progress } = await createTask(userId, project.id, taskCreateSchema.parse(args));
      return { task: taskView(task, { full: true }), projectProgress: progress, url: link(`/projects/${project.id}`) };
    },
  },
  {
    name: "create_task_in_projects",
    title: "Create task in several projects",
    description:
      "Create the same task in several projects at once – by default in every non-archived project linked to a Git repository (e.g. \"Update dependencies\"). Projects without write access are skipped.",
    inputSchema: {
      type: "object",
      properties: {
        projects: { type: "array", items: { type: "string" }, description: "Project ids or exact names; omit for all projects linked to Git" },
        title: { type: "string", maxLength: 200 },
        description: { type: "string", description: "Markdown" },
        dueDate: S.dueDate,
        labels: S.labels,
      },
      required: ["title"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const refs = z.array(ref).max(200).optional().parse(args.projects);
      const ids = refs
        ? await Promise.all(refs.map(async (r) => (await resolveProject(userId, r, "EDITOR")).project.id))
        : (
            await db.project.findMany({
              where: { AND: [visibleTo(userId), { repoUrl: { not: null } }, { status: { not: "ARCHIVED" } }] },
              select: { id: true },
            })
          ).map((p) => p.id);
      const input = taskBulkSchema.parse({ ...args, projectIds: ids.length ? ids : undefined });
      const { projectIds, ...fields } = input;
      const { created, skipped } = await createTaskInProjects(userId, projectIds, fields);
      return { created: created.map((c) => ({ project: c.project.name, projectId: c.project.id, taskId: c.task.id })), skipped };
    },
  },
  {
    name: "update_task",
    title: "Update task",
    description:
      "Move a task to another status (TODO, DOING, BLOCKED, DONE) and/or edit it. Only the given fields change. Set DOING when you start working on it and DONE when finished.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task id" },
        status: S.taskStatus,
        title: { type: "string", maxLength: 200 },
        description: { type: ["string", "null"], description: "Markdown; replaces the old description" },
        dueDate: S.dueDate,
        labels: S.labels,
        recurrence: S.recurrence,
      },
      required: ["task"],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
    run: async (args, { userId }) => {
      const { task: current } = await requireTask(userId, ref.parse(args.task), "EDITOR");
      const result = await updateTask(userId, current, taskUpdateSchema.parse(args));
      return {
        task: taskView(result.task, { full: true }),
        ...(result.spawned ? { nextRecurrence: taskView(result.spawned) } : {}),
        projectProgress: result.progress,
      };
    },
  },
  {
    name: "update_project",
    title: "Update project",
    description: "Change a project's status, priority, progress, summary or description. Only the given fields change.",
    inputSchema: {
      type: "object",
      properties: {
        project: S.project,
        status: { type: "string", enum: PROJECT_STATUSES },
        priority: { type: "integer", minimum: 1, maximum: 4, description: "1 low, 2 normal, 3 high, 4 critical" },
        progress: { type: "integer", minimum: 0, maximum: 100, description: "Ignored if the project derives progress from its tasks" },
        summary: { type: ["string", "null"], maxLength: 240, description: "One line" },
        description: { type: ["string", "null"], description: "Markdown" },
      },
      required: ["project"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const { project: current } = await resolveProject(userId, ref.parse(args.project), "EDITOR");
      const input = projectUpdateSchema.pick({ status: true, priority: true, progress: true, summary: true, description: true }).parse(args);
      // Stern-Schutz: Claude ändert den Status geschützter Projekte nicht – das bestätigt der Mensch in VibeWorks
      if (protectedChanges(current, input).length) throw new ApiError(409, tk("projects", "errors.protectedMcp", { name: current.name }));
      const data: Prisma.ProjectUncheckedUpdateInput = { ...input };
      const statusChanged = input.status !== undefined && input.status !== current.status;
      if (statusChanged) data.position = await nextPosition(current.ownerId, input.status!);
      const updated = await db.project.update({ where: { id: current.id }, data });
      const progress = updated.progressFromTasks ? await syncProjectProgress(current.id) : updated.progress;
      if (statusChanged) {
        await logActivity({
          projectId: current.id,
          userId,
          kind: "STATUS_CHANGED",
          summary: `Status: ${PROJECT_STATUS_MAP[current.status].label} → ${PROJECT_STATUS_MAP[updated.status].label}`,
          meta: { from: current.status, to: updated.status },
        });
      }
      const otherFields = Object.keys(input).filter((k) => !["status", "progress"].includes(k));
      if (otherFields.length) {
        await logActivity({ projectId: current.id, userId, kind: "PROJECT_UPDATED", summary: "Projektangaben bearbeitet", meta: { fields: otherFields } });
      }
      return { id: updated.id, name: updated.name, status: updated.status, priority: updated.priority, progress, summary: updated.summary };
    },
  },
  {
    name: "create_note",
    title: "Create note",
    description: "Add a Markdown note to a project – good for decisions, findings or a short work log.",
    inputSchema: {
      type: "object",
      properties: {
        project: S.project,
        title: { type: "string", maxLength: 200 },
        content: { type: "string", description: "Markdown, up to 50,000 characters" },
        pinned: { type: "boolean" },
      },
      required: ["project", "content"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const { project } = await resolveProject(userId, ref.parse(args.project), "EDITOR");
      const note = await createNote(userId, project.id, noteCreateSchema.parse(args));
      return { id: note.id, title: noteLabel(note), url: link(`/projects/${project.id}`) };
    },
  },
  {
    name: "get_note",
    title: "Get note",
    description: "Full text of one note.",
    inputSchema: { type: "object", properties: { note: { type: "string", description: "Note id" } }, required: ["note"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const { note, project } = await requireNote(userId, ref.parse(args.note));
      return {
        id: note.id,
        title: note.title,
        content: note.content,
        pinned: note.pinned,
        project: { id: project.id, name: project.name },
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      };
    },
  },
  {
    name: "get_claude_md",
    title: "Get CLAUDE.md",
    description:
      "A ready-made CLAUDE.md for a project: description, status, open tasks, pinned notes and the VibeWorks workflow. Useful as project context or to write it into the repository.",
    inputSchema: { type: "object", properties: { project: S.project }, required: ["project"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId, locale }) => {
      const { project } = await resolveProject(userId, ref.parse(args.project));
      return claudeMdFor(project, locale);
    },
  },
  {
    name: "list_prompts",
    title: "List prompts",
    description: "The user's prompt library (saved instructions), optionally filtered by text or project. Use get_prompt for the full text.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, project: { ...S.project, description: "Only prompts for this project plus general ones" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const input = z.object({ query: z.string().trim().max(100).optional(), project: ref.optional() }).parse(args);
      const projectId = input.project ? (await resolveProject(userId, input.project)).project.id : null;
      const q = input.query?.toLowerCase();
      const prompts = await db.prompt.findMany({
        where: { userId, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
        include: { project: { select: { name: true } } },
        orderBy: [{ uses: "desc" }, { updatedAt: "desc" }],
        take: 200,
      });
      return {
        prompts: prompts
          .filter((p) => !q || [p.title, p.body, ...p.tags].some((s) => s.toLowerCase().includes(q)))
          .map((p) => ({ id: p.id, title: p.title, tags: p.tags, project: p.project?.name ?? null, preview: truncate(p.body.replace(/\s+/g, " "), 160) })),
      };
    },
  },
  {
    name: "get_prompt",
    title: "Get prompt",
    description: "Full text of a saved prompt (by id or exact title). With a project, placeholders like {{projekt}}, {{repo}}, {{live}} and {{summary}} are filled in.",
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string", description: "Prompt id or exact title" }, project: { ...S.project, description: "Fill placeholders with this project" } },
      required: ["prompt"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const value = ref.parse(args.prompt);
      const prompt = await db.prompt.findFirst({ where: { userId, OR: [{ id: value }, { title: { equals: value, mode: "insensitive" } }] } });
      if (!prompt) throw notFound(tk("prompts", "errors.notFound"));
      const project = args.project ? (await resolveProject(userId, ref.parse(args.project))).project : null;
      return { title: prompt.title, text: fillPrompt(prompt.body, project) };
    },
  },
  {
    name: "search",
    title: "Search",
    description: "Full-text search across the user's notes, tasks and docs (German stemming, prefix matching). Matches are marked with **bold**.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 100 } }, required: ["query"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const res = await searchContent(userId, z.string().max(100).parse(args.query));
      return {
        notes: res.notes.map((n) => ({ ...n, snippet: highlight(n.snippet) })),
        tasks: res.tasks.map((t) => ({ ...t, snippet: highlight(t.snippet) })),
        docs: res.docs.map((d) => ({ ...d, snippet: highlight(d.snippet) })),
      };
    },
  },
  {
    name: "list_docs",
    title: "List docs",
    description: "The user's docs as a flat list with parentId (a page tree). Use get_doc for the content.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, { userId }) => ({
      docs: (await loadTree(userId)).map((d) => ({ id: d.id, parentId: d.parentId, title: d.title, icon: d.icon, kind: d.kind, pinned: d.pinned })),
    }),
  },
  {
    name: "get_doc",
    title: "Get doc",
    description: "Content of one doc page (Markdown, HTML source, or the archived text of a saved web page).",
    inputSchema: { type: "object", properties: { doc: { type: "string", description: "Doc id" } }, required: ["doc"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId }) => {
      const doc = await findOwnDoc(userId, ref.parse(args.doc));
      if (!doc) throw notFound(tk("mcp", "errors.docNotFound"));
      return {
        id: doc.id,
        parentId: doc.parentId,
        kind: doc.kind,
        title: doc.title,
        content: truncate(doc.content, MAX_TEXT),
        ...(doc.sourceUrl ? { sourceUrl: doc.sourceUrl } : {}),
        ...(doc.archive ? { archive: truncate(doc.archive, MAX_TEXT) } : {}),
        updatedAt: doc.updatedAt.toISOString(),
      };
    },
  },
  {
    name: "create_doc",
    title: "Create doc",
    description: "Create a Markdown doc page, optionally below a parent page.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 200 },
        content: { type: "string", description: "Markdown" },
        parent: { type: "string", description: "Id of the parent doc page" },
      },
      required: ["title"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const base = docCreateSchema.parse({ title: args.title, parentId: args.parent });
      const content = docUpdateSchema.shape.content.parse(args.content) ?? "";
      if (base.parentId && !(await findOwnDoc(userId, base.parentId))) throw notFound(tk("docs", "errors.parentNotFound"));
      const doc = await db.doc.create({
        data: { ownerId: userId, title: base.title, parentId: base.parentId, content, position: await nextDocPosition(userId, base.parentId) },
      });
      return { id: doc.id, title: doc.title, parentId: doc.parentId };
    },
  },
  {
    name: "update_doc",
    title: "Update doc",
    description: "Change a doc page: new title, replace the content, or append text to the end.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "string", description: "Doc id" },
        title: { type: "string", maxLength: 200 },
        content: { type: "string", description: "Replaces the whole content" },
        append: { type: "string", description: "Appended to the end (after a blank line)" },
      },
      required: ["doc"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const current = await findOwnDoc(userId, ref.parse(args.doc));
      if (!current) throw notFound(tk("mcp", "errors.docNotFound"));
      const input = z
        .object({ title: docUpdateSchema.shape.title, content: docUpdateSchema.shape.content, append: z.string().max(MAX_TEXT).optional() })
        .parse(args);
      const data: Prisma.DocUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      let content = input.content;
      if (input.append) content = `${(content ?? current.content).trimEnd()}\n\n${input.append}`.trimStart();
      if (content !== undefined) data.content = docUpdateSchema.shape.content.parse(content);
      const doc = Object.keys(data).length ? await db.doc.update({ where: { id: current.id }, data }) : current;
      return { id: doc.id, title: doc.title, length: doc.content.length, updatedAt: doc.updatedAt.toISOString() };
    },
  },
  {
    name: "get_repo_status",
    title: "Get repository status",
    description:
      "State of a project's repository and live site: provider, branch, last sync and its error, recent commits, CI runs, outdated or vulnerable dependencies, uptime and SSL.",
    inputSchema: { type: "object", properties: { project: S.project }, required: ["project"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, { userId, locale }) => {
      const { project } = await resolveProject(userId, ref.parse(args.project));
      const cache = await db.repoCache.findUnique({ where: { projectId: project.id } });
      const commits = (cache?.commits as unknown as Array<{ sha: string; title: string; author: string; date: string }> | null) ?? [];
      const ci = cache?.ci as { state?: string; runs?: unknown[] } | null;
      const deps = cache?.deps as {
        counts?: unknown;
        error?: string | null;
        packages?: Array<{ name: string; current: string | null; latest: string | null; level: string; advisories?: Array<{ severity: string; title: string }> }>;
      } | null;
      return {
        project: { id: project.id, name: project.name },
        repository: project.repoUrl
          ? {
              url: project.repoUrl,
              provider: cache?.provider || null,
              defaultBranch: cache?.defaultBranch ?? null,
              syncedAt: cache?.fetchedAt.toISOString() ?? null,
              syncError: cache?.error ? translateMessage(locale, cache.error) : null,
              failuresInRow: cache?.failCount ?? 0,
              recentCommits: commits.slice(0, 5).map((c) => ({ sha: c.sha.slice(0, 7), title: c.title, author: c.author, date: c.date })),
              ci: ci?.state ? { state: ci.state, runs: ci.runs ?? [] } : null,
              dependencies: deps
                ? {
                    counts: deps.counts ?? null,
                    error: deps.error ? translateMessage(locale, deps.error) : null,
                    attention: (deps.packages ?? [])
                      .filter((p) => p.level === "major" || p.advisories?.length)
                      .slice(0, 15)
                      .map((p) => ({ name: p.name, current: p.current, latest: p.latest, level: p.level, advisories: (p.advisories ?? []).map((a) => `${a.severity}: ${a.title}`) })),
                  }
                : null,
            }
          : null,
        liveSite: project.liveUrl
          ? {
              url: project.liveUrl,
              state: project.liveState,
              responseMs: project.liveMs,
              sslExpiresAt: project.sslExpiresAt?.toISOString() ?? null,
              error: project.liveError ? translateMessage(locale, project.liveError) : null,
            }
          : null,
        url: link(`/projects/${project.id}`),
      };
    },
  },
  {
    name: "list_problems",
    title: "List problems",
    description:
      "Everything that needs attention across the user's projects: Git sync and import errors, red CI, live sites that are down, dependencies with known vulnerabilities, overdue and blocked tasks.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, { userId, locale }) => loadProblems(userId, locale),
  },
  {
    name: "get_today",
    title: "Get today",
    description: "The user's plan for today (tasks they picked), suggestions (overdue, due today, in progress) and the running timer.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, { userId }) => loadToday(userId),
  },
  {
    name: "add_to_today",
    title: "Add to today",
    description: "Put a task on the user's list for today.",
    inputSchema: { type: "object", properties: { task: { type: "string", description: "Task id" } }, required: ["task"], additionalProperties: false },
    annotations: { idempotentHint: true },
    run: async (args, { userId }) => {
      const { task } = await requireTask(userId, ref.parse(args.task), "EDITOR");
      const today = dayKey(new Date());
      await db.taskFocus.deleteMany({ where: { userId, day: { lt: today } } }); // gestern ist vorbei
      const count = await db.taskFocus.count({ where: { userId, day: today, taskId: { not: task.id } } });
      if (count >= MAX_FOCUS) throw new ApiError(400, tk("today", "errors.full", { n: MAX_FOCUS }));
      await db.taskFocus.upsert({
        where: { userId_taskId_day: { userId, taskId: task.id, day: today } },
        create: { userId, taskId: task.id, day: today, position: count },
        update: {},
      });
      return { ok: true, day: today, task: taskView(task) };
    },
  },
  {
    name: "remove_from_today",
    title: "Remove from today",
    description: "Take a task off the user's list for today.",
    inputSchema: { type: "object", properties: { task: { type: "string", description: "Task id" } }, required: ["task"], additionalProperties: false },
    annotations: { idempotentHint: true },
    run: async (args, { userId }) => {
      const { count } = await db.taskFocus.deleteMany({ where: { userId, taskId: ref.parse(args.task), day: dayKey(new Date()) } });
      return { ok: true, removed: count > 0 };
    },
  },
  {
    name: "start_timer",
    title: "Start timer",
    description: "Start tracking time on a task (a running timer is stopped first). With focusMinutes it is a focus timer, otherwise a stopwatch.",
    inputSchema: {
      type: "object",
      properties: { task: { type: "string", description: "Task id" }, focusMinutes: { type: "integer", minimum: 5, maximum: 120 } },
      required: ["task"],
      additionalProperties: false,
    },
    run: async (args, { userId }) => {
      const input = z.object({ task: ref, focusMinutes: z.number().int().min(5).max(120).optional() }).parse(args);
      const { task } = await requireTask(userId, input.task);
      await stopRunning(userId);
      await db.timeEntry.create({ data: { userId, projectId: task.projectId, taskId: task.id, focusMinutes: input.focusMinutes ?? null } });
      return { running: await currentEntry(userId) };
    },
  },
  {
    name: "stop_timer",
    title: "Stop timer",
    description: "Stop the running timer, if any.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (_args, { userId }) => {
      const before = await currentEntry(userId);
      await stopRunning(userId);
      return { stopped: before ?? null };
    },
  },
];

// ── Gemeinsame Abfragen für Werkzeuge und Ressourcen ─────────

const OPEN_PROJECT = (userId: string) => ({ ...visibleTo(userId), buriedAt: null, status: { not: "ARCHIVED" as const } });

async function loadProblems(userId: string, locale: Locale) {
  const today = dayKey(new Date());
  const projects = await db.project.findMany({
    where: OPEN_PROJECT(userId),
    select: { id: true, name: true, liveUrl: true, liveState: true, liveError: true, repoCache: { select: { error: true, ci: true, deps: true } } },
    take: 500,
  });
  const gitErrors: Array<{ project: string; id: string; error: string }> = [];
  const redCi: Array<{ project: string; id: string; runs: Array<{ name: string; url: string | null }> }> = [];
  const sitesDown: Array<{ project: string; id: string; url: string | null; error: string | null }> = [];
  const vulnerableDependencies: Array<{ project: string; id: string; packages: Array<{ name: string; advisories: string[] }> }> = [];
  for (const p of projects) {
    const cache = p.repoCache;
    if (cache?.error) gitErrors.push({ project: p.name, id: p.id, error: translateMessage(locale, cache.error) });
    const ci = cache?.ci as { state?: string; runs?: Array<{ name: string; state: string; url: string | null }> } | null;
    if (ci?.state === "failure") redCi.push({ project: p.name, id: p.id, runs: (ci.runs ?? []).filter((r) => r.state === "failure").map((r) => ({ name: r.name, url: r.url })) });
    if (p.liveState === "down") sitesDown.push({ project: p.name, id: p.id, url: p.liveUrl, error: p.liveError ? translateMessage(locale, p.liveError) : null });
    const deps = cache?.deps as { packages?: Array<{ name: string; advisories?: Array<{ severity: string; title: string }> }> } | null;
    const risky = (deps?.packages ?? []).filter((x) => x.advisories?.length);
    if (risky.length) {
      vulnerableDependencies.push({ project: p.name, id: p.id, packages: risky.slice(0, 10).map((x) => ({ name: x.name, advisories: (x.advisories ?? []).map((a) => `${a.severity}: ${a.title}`) })) });
    }
  }
  const tasks = await db.task.findMany({
    where: { project: OPEN_PROJECT(userId), OR: [{ status: "BLOCKED" }, { status: { not: "DONE" }, dueDate: { lt: dayKeyToDate(today) } }] },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
  const connections = await db.gitCredential.findMany({ where: { userId, importError: { not: null } }, select: { host: true, importError: true } });
  return {
    gitErrors,
    gitConnections: connections.map((c) => ({ host: c.host, error: translateMessage(locale, c.importError ?? "") })),
    redCi,
    sitesDown,
    vulnerableDependencies,
    overdueTasks: tasks.filter((t) => t.status !== "BLOCKED").map((t) => taskView(t, { project: t.project })),
    blockedTasks: tasks.filter((t) => t.status === "BLOCKED").map((t) => taskView(t, { project: t.project })),
  };
}

async function loadToday(userId: string) {
  const today = dayKey(new Date());
  const focus = await db.taskFocus.findMany({
    where: { userId, day: today, task: { project: OPEN_PROJECT(userId) } },
    include: { task: { include: { project: { select: { id: true, name: true } } } } },
    orderBy: { position: "asc" },
  });
  const suggestions = await db.task.findMany({
    where: {
      id: { notIn: focus.map((f) => f.taskId) },
      status: { not: "DONE" },
      project: OPEN_PROJECT(userId),
      OR: [{ status: "DOING" }, { dueDate: { lte: dayKeyToDate(today) } }],
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
    take: 15,
  });
  return {
    day: today,
    planned: focus.map((f) => taskView(f.task, { project: f.task.project })),
    suggestions: suggestions.map((t) => taskView(t, { project: t.project })),
    timer: await currentEntry(userId),
    url: link("/today"),
  };
}

function markdownList(title: string, items: string[]): string[] {
  return items.length ? [`## ${title}`, ...items.map((i) => `- ${i}`), ""] : [];
}

// ── Prompts: die Prompt-Bibliothek als MCP-Prompts ───────────

/** Stabile Namen aus den Titeln (älteste zuerst, Doppelte mit -2, -3 …). */
async function promptEntries(userId: string) {
  const prompts = await db.prompt.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 200 });
  const used = new Map<string, number>();
  return prompts.map((prompt) => {
    const base = slugify(prompt.title).slice(0, 48) || "prompt";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { name: n > 1 ? `${base}-${n}` : base, prompt };
  });
}

export const MCP_PROMPTS: PromptProvider<McpContext> = {
  list: async ({ userId }) =>
    (await promptEntries(userId)).map(({ name, prompt }) => ({
      name,
      title: prompt.title,
      description: truncate(prompt.body.replace(/\s+/g, " "), 160),
      arguments: [{ name: "project", description: "Project id or exact name – fills {{projekt}}, {{repo}}, {{live}}, {{summary}}", required: false }],
    })),
  get: async (name, args, { userId }) => {
    const entry = (await promptEntries(userId)).find((e) => e.name === name);
    if (!entry) return null;
    const project = args.project ? (await resolveProject(userId, ref.parse(args.project))).project : null;
    // Zählt als Verwendung – „zuletzt geändert“ bleibt
    await db.$executeRaw`UPDATE "Prompt" SET "uses" = "uses" + 1 WHERE "id" = ${entry.prompt.id}`;
    return { description: entry.prompt.title, text: fillPrompt(entry.prompt.body, project) };
  },
};

// ── Ressourcen: CLAUDE.md je Projekt, „Was klemmt“ und „Heute“ ─

const CLAUDE_MD_URI = /^vibeworks:\/\/project\/([\w-]+)\/CLAUDE\.md$/;

export const MCP_RESOURCES: ResourceProvider<McpContext> = {
  list: async ({ userId }) => {
    const projects = await db.project.findMany({ where: OPEN_PROJECT(userId), select: { id: true, name: true, summary: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    return [
      { uri: "vibeworks://problems", name: "problems", title: "VibeWorks – what needs attention", mimeType: "text/markdown" },
      { uri: "vibeworks://today", name: "today", title: "VibeWorks – today's plan", mimeType: "text/markdown" },
      ...projects.map((p) => ({
        uri: `vibeworks://project/${p.id}/CLAUDE.md`,
        name: `claude-md-${slugify(p.name)}`,
        title: `CLAUDE.md – ${p.name}`,
        ...(p.summary ? { description: p.summary } : {}),
        mimeType: "text/markdown",
      })),
    ];
  },
  read: async (uri, { userId, locale }) => {
    if (uri === "vibeworks://problems") {
      const p = await loadProblems(userId, locale);
      const lines = [
        "# What needs attention",
        "",
        ...markdownList("Git sync errors", p.gitErrors.map((e) => `${e.project}: ${e.error}`)),
        ...markdownList("Git connections", p.gitConnections.map((c) => `${c.host}: ${c.error}`)),
        ...markdownList("Red CI", p.redCi.map((c) => `${c.project}: ${c.runs.map((r) => r.name).join(", ") || "failed"}`)),
        ...markdownList("Sites down", p.sitesDown.map((s) => `${s.project}: ${s.url ?? ""}${s.error ? ` (${s.error})` : ""}`)),
        ...markdownList("Vulnerable dependencies", p.vulnerableDependencies.map((v) => `${v.project}: ${v.packages.map((x) => x.name).join(", ")}`)),
        ...markdownList("Overdue tasks", p.overdueTasks.map((t) => `${t.project?.name ?? ""}: ${t.title} (due ${t.dueDate})`)),
        ...markdownList("Blocked tasks", p.blockedTasks.map((t) => `${t.project?.name ?? ""}: ${t.title}`)),
      ];
      if (lines.length === 2) lines.push("Nothing needs attention right now.");
      return { mimeType: "text/markdown", text: lines.join("\n") };
    }
    if (uri === "vibeworks://today") {
      const d = await loadToday(userId);
      const lines = [
        `# Today (${d.day})`,
        "",
        ...markdownList("Planned", d.planned.map((t) => `${t.project?.name ?? ""}: ${t.title} [${t.status}] (task ${t.id})`)),
        ...markdownList("Suggestions", d.suggestions.map((t) => `${t.project?.name ?? ""}: ${t.title} [${t.status}]${t.dueDate ? ` due ${t.dueDate}` : ""} (task ${t.id})`)),
      ];
      if (lines.length === 2) lines.push("Nothing planned and nothing due.");
      return { mimeType: "text/markdown", text: lines.join("\n") };
    }
    const m = uri.match(CLAUDE_MD_URI);
    if (!m) return null;
    const { project } = await resolveProject(userId, m[1]);
    return { mimeType: "text/markdown", text: await claudeMdFor(project, locale) };
  },
};
