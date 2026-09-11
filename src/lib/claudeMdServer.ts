import type { Project } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { makeT } from "./i18n/messages";
import type { Locale } from "./i18n/config";
import { TASK_ORDER } from "./tasks";
import { NOTE_ORDER } from "./notes";
import { buildClaudeMd } from "./claudeMd";

/** CLAUDE.md eines Projekts – für die Oberfläche und für Claude (MCP). Rechte prüft der Aufrufer. */
export async function claudeMdFor(project: Project, locale: Locale): Promise<string> {
  const [tasks, notes] = await Promise.all([
    db.task.findMany({ where: { projectId: project.id, status: { not: "DONE" } }, orderBy: TASK_ORDER, take: 200 }),
    db.note.findMany({ where: { projectId: project.id }, orderBy: NOTE_ORDER, take: 50 }),
  ]);
  return buildClaudeMd(
    { ...project, url: `${config.appUrl}/projects/${project.id}`, tasks, notes },
    makeT(locale, "prompts"),
    makeT(locale, "status"),
  );
}
