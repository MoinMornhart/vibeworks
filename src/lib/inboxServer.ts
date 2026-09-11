import type { InboxItem } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { randomToken } from "./crypto";
import { safeFetch } from "./security/ssrf";
import { logActivity } from "./activity";
import { nextPosition, uniqueSlug } from "./projects";
import { createTask } from "./actions";
import { MAX_INBOX_ITEMS, MAX_INBOX_TEXT, ntfyPollUrl, parseNtfyLines, splitIdea, type InboxSource } from "./inbox";

// Ideen-Eingang mit Datenbank: einwerfen, ntfy abholen, zu Projekt oder Aufgabe machen.

export function serializeInbox(i: InboxItem) {
  return { id: i.id, text: i.text, url: i.url, source: i.source as InboxSource, createdAt: i.createdAt.toISOString() };
}
export type InboxEntry = ReturnType<typeof serializeInbox>;

export async function addInboxItem(userId: string, item: { text: string; url?: string | null; source: InboxSource }) {
  const text = item.text.trim().slice(0, MAX_INBOX_TEXT);
  if (!text) return null;
  // Voll? Das Älteste fliegt raus – ein Eingang soll nicht unbegrenzt wachsen
  const count = await db.inboxItem.count({ where: { userId } });
  if (count >= MAX_INBOX_ITEMS) {
    const oldest = await db.inboxItem.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (oldest) await db.inboxItem.delete({ where: { id: oldest.id } });
  }
  return db.inboxItem.create({ data: { userId, text, url: item.url?.slice(0, 1000) || null, source: item.source } });
}

export async function inboxInfo(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { inboxToken: true, inboxNtfyUrl: true } });
  let token = user.inboxToken;
  if (!token) {
    token = randomToken(24);
    await db.user.update({ where: { id: userId }, data: { inboxToken: token } });
  }
  return { webhookUrl: `${config.appUrl}/api/inbox/in/${token}`, ntfyUrl: user.inboxNtfyUrl ?? "" };
}
export type InboxInfo = Awaited<ReturnType<typeof inboxInfo>>;

/** Idee → neues Projekt im Status „Idee“. */
export async function inboxToProject(userId: string, item: InboxItem) {
  const { name, description } = splitIdea(item.text, item.url);
  const project = await db.project.create({
    data: { ownerId: userId, name, description, status: "IDEA", slug: await uniqueSlug(userId, name), position: await nextPosition(userId, "IDEA") },
    select: { id: true, name: true },
  });
  await logActivity({ projectId: project.id, userId, kind: "PROJECT_CREATED", summary: `Projekt „${project.name}“ angelegt`, meta: { name: project.name } });
  await db.inboxItem.delete({ where: { id: item.id } });
  return project;
}

/** Idee → Aufgabe in einem Projekt (Rechte prüft der Aufrufer). */
export async function inboxToTask(userId: string, item: InboxItem, projectId: string) {
  const { name, description } = splitIdea(item.text, item.url);
  const { task } = await createTask(userId, projectId, { title: name.slice(0, 200), description, status: "TODO", dueDate: null, labels: [], recurrence: null });
  await db.inboxItem.delete({ where: { id: item.id } });
  return task;
}

/** ntfy-Themen aller Konten abfragen – neue Nachrichten landen im Eingang. */
export async function pollNtfyInboxes(): Promise<number> {
  const users = await db.user.findMany({ where: { inboxNtfyUrl: { not: null }, active: true }, select: { id: true, inboxNtfyUrl: true, inboxNtfySince: true } });
  let added = 0;
  for (const u of users) {
    const url = ntfyPollUrl(u.inboxNtfyUrl!, u.inboxNtfySince);
    if (!url) continue;
    try {
      const res = await safeFetch(url, { headers: { "User-Agent": "VibeWorks" }, timeoutMs: 15_000 });
      if (!res.ok) continue;
      const messages = parseNtfyLines(await res.text());
      for (const m of messages) {
        await addInboxItem(u.id, { text: m.text, url: m.url, source: "ntfy" });
        added++;
      }
      if (messages.length) await db.user.update({ where: { id: u.id }, data: { inboxNtfySince: messages[messages.length - 1].id } });
    } catch (err) {
      console.error("[inbox] ntfy", u.id, err);
    }
  }
  return added;
}
