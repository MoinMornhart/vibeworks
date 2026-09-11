import type { Shape } from "../types";
import { plural } from "../translate";

// Status, Prioritäten, Wiederholungen, Fälligkeiten, Akzentfarben – die festen
// Begriffe, die in vielen Bereichen vorkommen.

const de = {
  project: { IDEA: "Idee", PLANNING: "In Planung", OPEN: "Offen", IN_PROGRESS: "In Entwicklung", DONE: "Fertig", ARCHIVED: "Archiviert" },
  projectHint: {
    IDEA: "Noch ein Gedanke – nichts gebaut, nichts entschieden",
    PLANNING: "Umfang, Stack und Schnitt werden festgelegt",
    OPEN: "Startklar, liegt aber gerade still",
    IN_PROGRESS: "Wird aktiv gebaut",
    DONE: "Ausgeliefert und abgeschlossen",
    ARCHIVED: "Ruht – bleibt erhalten, im Board ausgeblendet",
  },
  task: { TODO: "Offen", DOING: "In Arbeit", BLOCKED: "Blockiert", DONE: "Erledigt" },
  priority: { "1": "Niedrig", "2": "Normal", "3": "Hoch", "4": "Kritisch" },
  recurrence: { DAILY: "Täglich", WEEKLY: "Wöchentlich", BIWEEKLY: "Alle zwei Wochen", MONTHLY: "Monatlich" },
  bucket: { overdue: "Überfällig", today: "Heute", week: "Diese Woche", later: "Später", none: "Ohne Termin" },
  accent: { violet: "Violett", cyan: "Cyan", emerald: "Smaragd", amber: "Bernstein", rose: "Rose", blue: "Blau" },
  due: {
    today: "heute",
    tomorrow: "morgen",
    yesterday: "gestern",
    overdue: plural("seit {n} Tag", "seit {n} Tagen"),
    inDays: plural("in {n} Tag", "in {n} Tagen"),
    title: "Fällig am {date}",
  },
};

const en: Shape<typeof de> = {
  project: { IDEA: "Idea", PLANNING: "Planning", OPEN: "Open", IN_PROGRESS: "In development", DONE: "Done", ARCHIVED: "Archived" },
  projectHint: {
    IDEA: "Just a thought – nothing built, nothing decided",
    PLANNING: "Scope, stack and approach are being defined",
    OPEN: "Ready to go, but currently on hold",
    IN_PROGRESS: "Actively being built",
    DONE: "Shipped and finished",
    ARCHIVED: "Resting – kept, but hidden from the board",
  },
  task: { TODO: "Open", DOING: "In progress", BLOCKED: "Blocked", DONE: "Done" },
  priority: { "1": "Low", "2": "Normal", "3": "High", "4": "Critical" },
  recurrence: { DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every two weeks", MONTHLY: "Monthly" },
  bucket: { overdue: "Overdue", today: "Today", week: "This week", later: "Later", none: "No date" },
  accent: { violet: "Violet", cyan: "Cyan", emerald: "Emerald", amber: "Amber", rose: "Rose", blue: "Blue" },
  due: {
    today: "today",
    tomorrow: "tomorrow",
    yesterday: "yesterday",
    overdue: plural("{n} day overdue", "{n} days overdue"),
    inDays: plural("in {n} day", "in {n} days"),
    title: "Due on {date}",
  },
};

export default { de, en };
