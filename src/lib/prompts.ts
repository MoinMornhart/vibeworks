import type { Prompt } from "@prisma/client";
import type { Locale } from "./i18n/config";

// Prompt-Bibliothek: bewährte Anweisungen für Claude & Co. Platzhalter wie
// {{projekt}} werden beim Kopieren mit einem Projekt gefüllt. Ohne Datenbank.

export const MAX_PROMPTS = 500;
export const PLACEHOLDERS = ["{{projekt}}", "{{repo}}", "{{live}}", "{{summary}}"] as const;

export interface PromptContext {
  name: string;
  repoUrl: string | null;
  liveUrl: string | null;
  summary: string | null;
}

/** Platzhalter einsetzen – unbekannte bleiben stehen, ohne Projekt bleibt alles, wie es ist. */
export function fillPrompt(body: string, ctx: PromptContext | null): string {
  if (!ctx) return body;
  const values: Record<string, string> = {
    projekt: ctx.name,
    project: ctx.name,
    repo: ctx.repoUrl ?? "",
    live: ctx.liveUrl ?? "",
    summary: ctx.summary ?? "",
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key.toLowerCase()] ?? match);
}

export function serializePrompt(p: Prompt & { project?: { id: string; name: string } | null }) {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    tags: p.tags,
    projectId: p.projectId,
    project: p.project ?? null,
    uses: p.uses,
    updatedAt: p.updatedAt.toISOString(),
  };
}
export type PromptItem = ReturnType<typeof serializePrompt>;

type Starter = { title: string; body: string; tags: string[] };

/** Beispiele für den Anfang – in der Sprache des Kontos. */
export const STARTER_PROMPTS: Record<Locale, Starter[]> = {
  de: [
    {
      title: "Offene Aufgaben abarbeiten",
      body: "Hole dir mit dem VibeWorks-MCP-Server die offenen Aufgaben von „{{projekt}}“ (list_tasks). Nimm dir die wichtigste vor, setze sie auf DOING, setze sie um, teste gründlich und setze sie danach auf DONE. Halte in einer Notiz (create_note) fest, was du gemacht hast.",
      tags: ["claude", "aufgaben"],
    },
    {
      title: "Code-Review",
      body: "Sieh dir die letzten Änderungen im Repository {{repo}} kritisch an: Fehler, Sicherheitslücken, Randfälle, unnötige Komplexität. Nenne jeden Fund mit Datei, Zeile und einem konkreten Vorschlag – sortiert nach Schwere.",
      tags: ["review"],
    },
    {
      title: "Fehler eingrenzen",
      body: "Folgender Fehler tritt auf: <Fehlermeldung oder Beobachtung>. Grenze die Ursache systematisch ein, bevor du etwas änderst: Hypothesen aufstellen, mit Logs oder einem kleinen Test prüfen, dann die kleinste saubere Korrektur umsetzen und mit einem Test absichern.",
      tags: ["debugging"],
    },
    {
      title: "Tests schreiben",
      body: "Schreibe Tests für <Modul oder Funktion>: normale Fälle, Grenzfälle und Fehlerfälle. Nutze das Testframework, das im Projekt schon verwendet wird, und ändere dafür keinen Produktionscode – außer, ein Test deckt einen echten Fehler auf.",
      tags: ["tests"],
    },
    {
      title: "README auffrischen",
      body: "Überarbeite die README von „{{projekt}}“: Worum geht es ({{summary}}), wie installiert und startet man es, wie entwickelt man daran? Kurz, mit Beispielen, ohne Marketing-Sprache. Live-Seite: {{live}}",
      tags: ["doku"],
    },
  ],
  en: [
    {
      title: "Work through open tasks",
      body: "Use the VibeWorks MCP server to fetch the open tasks of “{{project}}” (list_tasks). Pick the most important one, set it to DOING, implement it, test thoroughly and then set it to DONE. Record what you did in a note (create_note).",
      tags: ["claude", "tasks"],
    },
    {
      title: "Code review",
      body: "Critically review the latest changes in the repository {{repo}}: bugs, security issues, edge cases, needless complexity. Report every finding with file, line and a concrete suggestion – sorted by severity.",
      tags: ["review"],
    },
    {
      title: "Narrow down a bug",
      body: "This bug occurs: <error message or observation>. Narrow down the cause systematically before changing anything: form hypotheses, check them with logs or a small test, then make the smallest clean fix and cover it with a test.",
      tags: ["debugging"],
    },
    {
      title: "Write tests",
      body: "Write tests for <module or function>: normal cases, edge cases and error cases. Use the test framework the project already uses and don't change production code for it – unless a test uncovers a real bug.",
      tags: ["tests"],
    },
    {
      title: "Refresh the README",
      body: "Rework the README of “{{project}}”: what is it about ({{summary}}), how do you install and start it, how do you develop on it? Short, with examples, no marketing speak. Live site: {{live}}",
      tags: ["docs"],
    },
  ],
};
