import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „today“: Heute-Ansicht.

const de = {
  title: "Heute",
  summary: "{done} von {n} erledigt",
  emptyHint: "Such dir bis zu fünf Aufgaben für heute aus – mehr schafft ohnehin niemand an einem Tag.",
  focus: "Dein Fokus",
  free: "Freier Platz",
  allDone: "Alles geschafft – schönen Feierabend! 🎉",
  suggestions: "Vorschläge",
  suggestionsHint: "Überfällig, heute fällig oder schon in Arbeit",
  noSuggestions: "Nichts Dringendes – such dir unter „Aufgaben“ etwas aus.",
  add: "Für heute",
  remove: "Aus „Heute“ nehmen",
  full: "Heute ist voll – höchstens fünf Aufgaben.",
  doneToday: plural("Heute insgesamt {n} Aufgabe erledigt", "Heute insgesamt {n} Aufgaben erledigt"),
  toTasks: "Alle Aufgaben",
  toggleAdd: "Für heute vormerken",
  toggleRemove: "Aus „Heute“ nehmen",
  errors: { full: "Höchstens {n} Aufgaben für heute." },
};

const en: Shape<typeof de> = {
  title: "Today",
  summary: "{done} of {n} done",
  emptyHint: "Pick up to five tasks for today – nobody gets more done in a day anyway.",
  focus: "Your focus",
  free: "Free slot",
  allDone: "All done – enjoy your evening! 🎉",
  suggestions: "Suggestions",
  suggestionsHint: "Overdue, due today or already in progress",
  noSuggestions: "Nothing urgent – pick something under “Tasks”.",
  add: "For today",
  remove: "Remove from “Today”",
  full: "Today is full – at most five tasks.",
  doneToday: plural("{n} task done today in total", "{n} tasks done today in total"),
  toTasks: "All tasks",
  toggleAdd: "Plan for today",
  toggleRemove: "Remove from “Today”",
  errors: { full: "At most {n} tasks for today." },
};

export default { de, en };
