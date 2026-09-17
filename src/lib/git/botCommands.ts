import type { Prisma, Task, TaskStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { appLink, notifyUser } from "@/lib/notify";
import { nextTaskPosition, syncProjectProgress, transitionTask } from "@/lib/tasks";
import { dayKeyToDate } from "@/lib/taskDates";
import { statusLabelsOf } from "@/lib/boardConfig";
import { isAiLocked } from "@/lib/aiLock";
import { normalizeGitPeople, roleOf } from "./issueImportLogic";
import type { IssueApi, IssueComment } from "./providers";
import { BOT_MARKER, describeCommand, HELP_TEXT, infoText, mayCommand, mentionsBot, parseCommands, replyText, REPLY_MARKER, type BotCommand } from "./botCommandsLogic";
import { truncate } from "@/lib/utils";

// Bot-Befehle aus Issue-Kommentaren ausführen (#79, #81). Läuft beim
// Issue-Abgleich mit: neue Kommentare seit dem letzten Lauf lesen, Befehle
// von Mitarbeitenden mit Schreibrecht auf die Aufgabe anwenden und im Issue
// antworten. Geschrieben wird mit dem Issue-Zugang (Bot, sonst Besitzer).

const FIRST_LOOKBACK_MS = 60 * 60_000;
const MAX_LOOKBACK_MS = 24 * 60 * 60_000;
const MAX_COMMENTS = 30;
const PERMISSION_TTL = 10 * 60_000;
const permissions = new Map<string, { at: number; value: string | null }>();

export async function permissionOf(api: IssueApi, projectId: string, login: string): Promise<string | null> {
  const key = `${projectId}:${login.toLowerCase()}`;
  const hit = permissions.get(key);
  if (hit && Date.now() - hit.at < PERMISSION_TTL) return hit.value;
  const value = await api.permission(login).catch(() => null);
  permissions.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Antworten im Issue melden (#109): alles von Menschen, was nicht aus
 * VibeWorks selbst kommt. Empfänger sind die Besitzerin des Projekts und wer
 * die Aufgabe angelegt hat – jeder nur einmal je Kommentar.
 */
async function notifyReplies(projectId: string, comments: IssueComment[], botLogin: string | null): Promise<void> {
  const own = botLogin?.toLowerCase() ?? null;
  const human = comments.filter((c) => c.author && c.author.toLowerCase() !== own && !c.author.endsWith("[bot]") && !c.body.includes(REPLY_MARKER) && !c.body.includes(BOT_MARKER));
  if (!human.length) return;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true, ownerId: true } });
  if (!project) return;
  const tasks = await db.task.findMany({
    where: { projectId, issueNumber: { in: [...new Set(human.map((c) => c.issueNumber))] } },
    select: { id: true, title: true, issueNumber: true, createdById: true },
  });
  const byNumber = new Map(tasks.map((t) => [t.issueNumber!, t]));
  for (const c of human.slice(-MAX_COMMENTS)) {
    const task = byNumber.get(c.issueNumber);
    if (!task) continue;
    for (const userId of new Set([project.ownerId, task.createdById].filter((x): x is string => Boolean(x)))) {
      await notifyUser(userId, "issueComment", (t) => ({
        event: "issueComment",
        title: t("events.issueComment.title", { author: c.author, title: truncate(task.title, 60) }),
        message: t("events.issueComment.message", { text: truncate(c.body.replace(/\s+/g, " ").trim(), 300) }),
        url: appLink(`/projects/${projectId}?aufgabe=${task.id}#tasks`),
      }), { projectId, author: c.author });
    }
  }
}

/** Befehle anwenden – ohne after(), der Abgleich läuft auch außerhalb von Anfragen. */
async function applyCommands(task: Task, commands: BotCommand[], login: string): Promise<{ task: Task; lines: string[]; wantsInfo: boolean; wantsHelp: boolean; changed: boolean }> {
  const data: Prisma.TaskUncheckedUpdateInput = {};
  const lines: string[] = [];
  let status: TaskStatus | null = null;
  let wantsInfo = false;
  let wantsHelp = false;
  for (const c of commands) {
    if (c.kind === "status") status = c.status;
    else if (c.kind === "prio") data.priority = c.priority;
    else if (c.kind === "assign") data.assignee = c.who ?? `@${login}`;
    else if (c.kind === "unassign") data.assignee = null;
    else if (c.kind === "due") data.dueDate = c.date ? dayKeyToDate(c.date) : null;
    else if (c.kind === "note") data.aiNote = c.text;
    else if (c.kind === "info") wantsInfo = true;
    else if (c.kind === "help") wantsHelp = true;
    const line = c.kind === "assign" ? describeCommand({ kind: "assign", who: c.who ?? `@${login}` }) : describeCommand(c);
    if (line) lines.push(line);
  }
  const changed = Object.keys(data).length > 0 || (status !== null && status !== task.status);
  let updated = task;
  if (status && status !== task.status) {
    data.position = await nextTaskPosition(db, task.projectId, status);
    updated = (await db.$transaction((tx) => transitionTask(tx, task, status, null, data))).task;
  } else if (Object.keys(data).length) {
    updated = await db.task.update({ where: { id: task.id }, data });
  }
  if (changed) await syncProjectProgress(task.projectId);
  return { task: updated, lines, wantsInfo, wantsHelp, changed };
}

/**
 * Neue Kommentare prüfen und Befehle ausführen. Liefert die geänderten
 * Aufgaben – deren Issues bringt der Abgleich danach auf den neuen Stand.
 */
export async function runBotCommands(projectId: string, api: IssueApi, botLogin: string | null): Promise<string[]> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { issueCommentsAt: true, boardConfig: true, gitPeople: true } });
  if (!project) return [];
  const now = Date.now();
  const stored = project.issueCommentsAt?.getTime() ?? 0;
  // Beim ersten Mal nur die letzte Stunde; nach langer Pause höchstens einen Tag zurück
  const since = new Date(stored ? Math.max(stored, now - MAX_LOOKBACK_MS) : now - FIRST_LOOKBACK_MS);

  let comments: IssueComment[];
  try {
    comments = await api.commentsSince(since);
  } catch (err) {
    console.warn("[bot] Kommentare %s:", projectId, err instanceof Error ? err.message : err);
    return [];
  }
  const newest = comments.reduce((max, c) => Math.max(max, new Date(c.createdAt).getTime()), since.getTime());
  await db.project.update({ where: { id: projectId }, data: { issueCommentsAt: new Date(newest) } });

  await notifyReplies(projectId, comments, botLogin).catch((err) => console.warn("[bot] Meldung:", err));

  const own = botLogin?.toLowerCase() ?? null;
  const relevant = comments
    .filter((c) => c.author && c.author.toLowerCase() !== own && !c.author.endsWith("[bot]"))
    .map((c) => ({ c, commands: parseCommands(c.body) }))
    .filter((x) => x.commands.length > 0 || mentionsBot(x.c.body, botLogin))
    .slice(0, MAX_COMMENTS);
  if (!relevant.length) return [];

  const tasks = await db.task.findMany({ where: { projectId, issueNumber: { in: [...new Set(relevant.map((x) => x.c.issueNumber))] } } });
  const byNumber = new Map(tasks.map((t) => [t.issueNumber!, t]));
  const labels = statusLabelsOf(project.boardConfig);
  const people = normalizeGitPeople(project.gitPeople);
  const changedIds = new Set<string>();

  for (const { c, commands } of relevant) {
    const task = byNumber.get(c.issueNumber);
    if (!task) continue; // kein Issue aus VibeWorks
    if (isAiLocked(task, project.boardConfig)) continue; // gesperrt (#76): nur in VibeWorks bearbeiten
    try {
      // Nur angesprochen: Hilfe zeigen – das darf jeder sehen
      if (!commands.length) {
        await api.comment(c.issueNumber, replyText([], HELP_TEXT, c.author));
        continue;
      }
      // Rolle im Projekt (Arbeiter, Bughunter) oder Schreibrecht im Repository (#69)
      if (!roleOf(people, c.author) && !mayCommand(await permissionOf(api, projectId, c.author))) {
        await api.comment(c.issueNumber, replyText(["⛔ Befehle dürfen nur Mitarbeitende mit Schreibrecht in diesem Repository geben."], null, c.author));
        continue;
      }
      const result = await applyCommands(task, commands, c.author);
      byNumber.set(c.issueNumber, result.task);
      if (result.changed) changedIds.add(task.id);
      const info = result.wantsInfo
        ? infoText({
            title: result.task.title,
            status: result.task.status,
            statusLabel: labels[result.task.status] ?? null,
            priority: result.task.priority,
            assignee: result.task.assignee,
            dueDate: result.task.dueDate?.toISOString().slice(0, 10) ?? null,
            aiNote: result.task.aiNote,
            url: appLink(`/projects/${projectId}`),
          })
        : null;
      await api.comment(c.issueNumber, replyText(result.lines, [info, result.wantsHelp ? HELP_TEXT : null].filter(Boolean).join("\n\n") || null, c.author));
    } catch (err) {
      console.warn("[bot] Befehl in #%s:", String(c.issueNumber), err instanceof Error ? err.message : err);
    }
  }
  return [...changedIds];
}
