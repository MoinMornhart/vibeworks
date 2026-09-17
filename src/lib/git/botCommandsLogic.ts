import type { TaskStatus } from "@/generated/prisma/client";

// Befehle an den VibeWorks-Bot per Issue-Kommentar (#79, #81), z. B.
//   /status erledigt   /prio 3   /übernehmen   /fällig 2026-10-01   /info   /hilfe
// Reine Logik: Kommentare lesen, Befehle erkennen, Antworten bauen.

/** Unsichtbare Marke an Kommentaren des Bots – die liest er nicht wieder als Befehl. */
export const BOT_MARKER = "<!-- vibeworks:bot -->";
/** Marke an Antworten, die aus VibeWorks geschrieben wurden (#76). */
export const REPLY_MARKER = "<!-- vibeworks:reply -->";
/** Höchstens so viele Befehle je Kommentar. */
const MAX_COMMANDS = 5;

export type BotCommand =
  | { kind: "status"; status: TaskStatus }
  | { kind: "prio"; priority: number }
  | { kind: "assign"; who: string | null }
  | { kind: "unassign" }
  | { kind: "due"; date: string | null }
  | { kind: "note"; text: string }
  | { kind: "info" }
  | { kind: "help" }
  | { kind: "unknown"; raw: string; reason: "command" | "value" };

const STATUS_WORDS: Record<string, TaskStatus> = {
  todo: "TODO", offen: "TODO", open: "TODO", neu: "TODO",
  doing: "DOING", arbeit: "DOING", "in-arbeit": "DOING", inarbeit: "DOING", progress: "DOING", start: "DOING",
  blocked: "BLOCKED", blockiert: "BLOCKED", block: "BLOCKED",
  done: "DONE", erledigt: "DONE", fertig: "DONE", closed: "DONE",
};

const PRIO_WORDS: Record<string, number> = { niedrig: 1, low: 1, normal: 2, hoch: 3, high: 3, dringend: 4, kritisch: 4, urgent: 4, critical: 4 };

/** Datum aus „2026-10-01“ oder „01.10.2026“ – null bei „keins“. undefined = unlesbar. */
export function parseDue(arg: string): string | null | undefined {
  const a = arg.trim().toLowerCase();
  if (["keins", "kein", "none", "-", "weg"].includes(a)) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const deMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(a);
  const iso = isoMatch ? a : deMatch ? `${deMatch[3]}-${deMatch[2].padStart(2, "0")}-${deMatch[1].padStart(2, "0")}` : null;
  if (!iso) return undefined;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? undefined : iso;
}

function parseOne(name: string, arg: string): BotCommand {
  const raw = `/${name}${arg ? ` ${arg}` : ""}`.slice(0, 80);
  const word = arg.trim().toLowerCase().replace(/\s+/g, "-");
  switch (name) {
    case "status": {
      const status = STATUS_WORDS[word];
      return status ? { kind: "status", status } : { kind: "unknown", raw, reason: "value" };
    }
    case "erledigt":
    case "done":
      return { kind: "status", status: "DONE" };
    case "blockiert":
    case "blocked":
      return { kind: "status", status: "BLOCKED" };
    case "start":
    case "starten":
      return { kind: "status", status: "DOING" };
    case "prio":
    case "priorität":
    case "prioritaet":
    case "priority": {
      const n = /^[1-4]$/.test(word) ? Number(word) : PRIO_WORDS[word];
      return n ? { kind: "prio", priority: n } : { kind: "unknown", raw, reason: "value" };
    }
    case "übernehmen":
    case "uebernehmen":
    case "assign":
    case "zuweisen": {
      const who = arg.trim().replace(/^@/, "").slice(0, 60);
      if (who && !/^[\p{L}\p{N} ._-]+$/u.test(who)) return { kind: "unknown", raw, reason: "value" };
      return { kind: "assign", who: who || null };
    }
    case "freigeben":
    case "unassign":
      return { kind: "unassign" };
    case "fällig":
    case "faellig":
    case "due": {
      const date = parseDue(arg);
      return date === undefined ? { kind: "unknown", raw, reason: "value" } : { kind: "due", date };
    }
    case "ki":
    case "ai":
    case "hinweis":
    case "note": {
      const text = arg.trim().slice(0, 4000);
      return text ? { kind: "note", text } : { kind: "unknown", raw, reason: "value" };
    }
    case "info":
    case "stand":
      return { kind: "info" };
    case "hilfe":
    case "help":
    case "befehle":
      return { kind: "help" };
    default:
      return { kind: "unknown", raw, reason: "command" };
  }
}

/**
 * Befehle aus einem Kommentar: jede Zeile, die mit „/befehl“ beginnt (davor darf
 * eine Erwähnung wie „@vibeworks-bot“ stehen). Zitate und Code-Blöcke zählen nicht.
 */
export function parseCommands(body: string): BotCommand[] {
  if (body.includes(BOT_MARKER) || body.includes(REPLY_MARKER)) return [];
  const out: BotCommand[] = [];
  let inCode = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || line.startsWith(">")) continue;
    const m = /^(?:@[\w-]+(?:\[bot\])?[,:]?\s+)?\/([\p{L}]{2,20})(?:\s+(.*))?$/u.exec(line.slice(0, 4100));
    if (!m) continue;
    out.push(parseOne(m[1].toLowerCase(), m[2] ?? ""));
    if (out.length >= MAX_COMMANDS) break;
  }
  return out;
}

/** Wird der Bot angesprochen, ohne einen Befehl zu nennen? Dann antwortet er mit der Hilfe. */
export function mentionsBot(body: string, botLogin: string | null): boolean {
  if (body.includes(BOT_MARKER) || body.includes(REPLY_MARKER)) return false;
  const names = ["@vibeworks", ...(botLogin ? [`@${botLogin.replace(/\[bot\]$/, "")}`] : [])].map((n) => n.toLowerCase());
  const text = body.toLowerCase();
  return names.some((n) => text.includes(n));
}

/** Nur wer im Repository schreiben darf, darf Befehle geben. */
export const mayCommand = (permission: string | null) => permission === "admin" || permission === "maintain" || permission === "write";

const STATUS_TEXT: Record<TaskStatus, string> = { TODO: "Offen", DOING: "In Arbeit", BLOCKED: "Blockiert", DONE: "Erledigt" };
const PRIO_TEXT: Record<number, string> = { 1: "Niedrig", 2: "Normal", 3: "Hoch", 4: "Kritisch" };

export const HELP_TEXT = [
  "**VibeWorks-Bot – Befehle** (jeweils in eine eigene Zeile schreiben):",
  "",
  "| Befehl | Wirkung |",
  "|---|---|",
  "| `/status offen·arbeit·blockiert·erledigt` | Spalte der Aufgabe ändern (auch `/erledigt`, `/start`, `/blockiert`) |",
  "| `/prio 1–4` oder `/prio hoch` | Priorität setzen (1 niedrig … 4 kritisch) |",
  "| `/übernehmen` oder `/übernehmen Name` | Bearbeiter eintragen (ohne Namen: du selbst) |",
  "| `/freigeben` | Bearbeiter entfernen |",
  "| `/fällig 2026-10-01` oder `/fällig keins` | Fälligkeit setzen oder entfernen |",
  "| `/ki Text` | Hinweis an die KI setzen |",
  "| `/info` | Stand der Aufgabe anzeigen |",
  "| `/hilfe` | Diese Übersicht |",
  "",
  "Befehle dürfen alle mit Schreibrecht im Repository oder einer Rolle im Projekt (Arbeiter, Bughunter) geben. Der Bot antwortet, sobald VibeWorks das Repository abgleicht (spätestens nach ein paar Minuten).",
].join("\n");

export interface TaskInfoForBot {
  title: string;
  status: TaskStatus;
  statusLabel?: string | null;
  priority: number;
  assignee: string | null;
  dueDate: string | null;
  aiNote: string | null;
  url: string;
}

export function infoText(t: TaskInfoForBot): string {
  return [
    `**${t.title}**`,
    "",
    `- Status: ${t.statusLabel || STATUS_TEXT[t.status]}`,
    `- Priorität: ${PRIO_TEXT[t.priority] ?? t.priority}`,
    `- Bearbeitet von: ${t.assignee ?? "–"}`,
    `- Fällig: ${t.dueDate ? t.dueDate.split("-").reverse().join(".") : "–"}`,
    ...(t.aiNote ? [`- Hinweis an die KI: ${t.aiNote.slice(0, 300)}`] : []),
    `- In VibeWorks: ${t.url}`,
  ].join("\n");
}

/** Antwort des Bots: erledigte Schritte, Fehler, ggf. Info oder Hilfe – immer mit Marke. */
export function replyText(lines: string[], extra: string | null, login: string): string {
  const head = lines.length ? `@${login}\n\n${lines.map((l) => `- ${l}`).join("\n")}` : `@${login}`;
  return [head, extra, BOT_MARKER].filter(Boolean).join("\n\n");
}

export function describeCommand(c: BotCommand): string {
  switch (c.kind) {
    case "status":
      return `✅ Status → ${STATUS_TEXT[c.status]}`;
    case "prio":
      return `✅ Priorität → ${PRIO_TEXT[c.priority]}`;
    case "assign":
      return `✅ Bearbeiter → ${c.who}`;
    case "unassign":
      return "✅ Bearbeiter entfernt";
    case "due":
      return c.date ? `✅ Fällig → ${c.date.split("-").reverse().join(".")}` : "✅ Fälligkeit entfernt";
    case "note":
      return "✅ Hinweis an die KI gespeichert";
    case "unknown":
      return c.reason === "command" ? `❓ Unbekannter Befehl \`${c.raw}\` – \`/hilfe\` zeigt alle` : `❓ Ungültiger Wert in \`${c.raw}\` – \`/hilfe\` zeigt Beispiele`;
    default:
      return "";
  }
}
