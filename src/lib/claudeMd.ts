import type { ProjectStatus, TaskStatus } from "@prisma/client";
import type { TFunction } from "./i18n/messages";
import { dayKey, truncate } from "./utils";

// CLAUDE.md eines Projekts: alles, was Claude Code zum Einstieg wissen
// sollte – Beschreibung, Stand, offene Aufgaben, wichtige Notizen und die
// Arbeitsweise mit VibeWorks. Ohne Datenbank; die Texte kommen über t().

export interface ClaudeMdInput {
  name: string;
  summary: string | null;
  description: string | null;
  status: ProjectStatus;
  priority: number;
  progress: number;
  tags: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  issueSync: boolean;
  url: string;
  tasks: Array<{ title: string; status: TaskStatus; dueDate: Date | null; issueNumber: number | null; description: string | null }>;
  notes: Array<{ title: string | null; content: string; pinned: boolean }>;
}

export function buildClaudeMd(p: ClaudeMdInput, t: TFunction<"prompts">, ts: TFunction<"status">): string {
  const out: string[] = [`# ${p.name}`, ""];
  if (p.summary?.trim()) out.push(`> ${p.summary.trim()}`, "");
  if (p.description?.trim()) out.push(p.description.trim(), "");

  const priority = String(Math.min(4, Math.max(1, p.priority))) as "1" | "2" | "3" | "4";
  out.push(`## ${t("md.project")}`, "");
  out.push(`- ${t("md.status")}: ${ts(`project.${p.status}`)} · ${t("md.priority")}: ${ts(`priority.${priority}`)} · ${t("md.progress")}: ${p.progress} %`);
  if (p.repoUrl) out.push(`- ${t("md.repo")}: ${p.repoUrl}`);
  if (p.liveUrl) out.push(`- ${t("md.live")}: ${p.liveUrl}`);
  if (p.tags.length) out.push(`- ${t("md.tags")}: ${p.tags.join(", ")}`);
  out.push(`- VibeWorks: ${p.url}`, "");

  const open = p.tasks.filter((x) => x.status !== "DONE");
  out.push(`## ${t("md.openTasks")}`, "");
  if (!open.length) out.push(t("md.noTasks"), "");
  for (const status of ["DOING", "BLOCKED", "TODO"] as const) {
    const list = open.filter((x) => x.status === status);
    if (!list.length) continue;
    out.push(`### ${ts(`task.${status}`)}`, "");
    for (const task of list) {
      const extra = [task.dueDate ? t("md.due", { date: dayKey(task.dueDate) }) : null, task.issueNumber ? `#${task.issueNumber}` : null].filter(Boolean).join(" · ");
      out.push(`- [ ] ${task.title}${extra ? ` (${extra})` : ""}`);
      if (task.description?.trim()) out.push(`  ${truncate(task.description.trim().replace(/\s+/g, " "), 200)}`);
    }
    out.push("");
  }

  if (p.notes.length) {
    const pinned = p.notes.filter((n) => n.pinned).slice(0, 5);
    const others = p.notes.filter((n) => !n.pinned).slice(0, 15);
    out.push(`## ${t("md.notes")}`, "");
    for (const n of pinned) out.push(`### ${n.title?.trim() || t("md.note")}`, "", truncate(n.content.trim(), 2000), "");
    if (others.length) {
      out.push(t("md.moreNotes"), "");
      for (const n of others) out.push(`- ${n.title?.trim() || truncate(n.content.trim().split("\n")[0], 80)}`);
      out.push("");
    }
  }

  out.push(`## ${t("md.workflow")}`, "");
  out.push(`- ${t("md.w1", { name: p.name })}`);
  out.push(`- ${t("md.w2")}`);
  if (p.repoUrl && p.issueSync) out.push(`- ${t("md.w3")}`);
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
