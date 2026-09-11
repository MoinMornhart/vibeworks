import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „data“: Projektvorlagen, Export und Import.

const de = {
  templates: {
    label: "Vorlage",
    empty: "Leer",
    contains: "+ {tasks} · {notes}",
    tasks: plural("{n} Aufgabe", "{n} Aufgaben"),
    notes: plural("{n} Notiz", "{n} Notizen"),
    deleteOwn: "Vorlage „{name}“ löschen",
    confirmDelete: "Vorlage „{name}“ löschen?",
    saveAs: "Als Vorlage speichern",
    namePrompt: "Name der Vorlage:",
    saved: "Vorlage „{name}“ gespeichert – du findest sie beim Anlegen eines neuen Projekts.",
  },
  export: {
    project: "Exportieren (JSON)",
    all: "Alles exportieren",
  },
  more: "Weitere Aktionen",
  section: {
    title: "Daten",
    description:
      "Alle deine Projekte mit Aufgaben und Notizen sowie deine Docs als JSON-Datei sichern – oder eine solche Datei wieder einlesen. Tokens und andere Geheimnisse sind nie enthalten.",
    importLabel: "Datei importieren",
    importHint: "Importierte Projekte und Seiten kommen immer neu dazu – vorhandene werden nicht überschrieben.",
    importing: "Importiere …",
    imported: "Importiert: {projects}, {tasks}, {notes}, {docs}.",
    projects: plural("{n} Projekt", "{n} Projekte"),
    docs: plural("{n} Seite", "{n} Seiten"),
    invalidFile: "Die Datei ist kein gültiges JSON.",
  },
  errors: {
    templateNotFound: "Diese Vorlage gibt es nicht (mehr).",
    tooManyTemplates: "Höchstens 100 eigene Vorlagen.",
    format: "Das ist kein VibeWorks-Export.",
    version: "Der Export stammt aus einer neueren VibeWorks-Version – bitte erst aktualisieren.",
  },
};

const en: Shape<typeof de> = {
  templates: {
    label: "Template",
    empty: "Blank",
    contains: "+ {tasks} · {notes}",
    tasks: plural("{n} task", "{n} tasks"),
    notes: plural("{n} note", "{n} notes"),
    deleteOwn: "Delete template “{name}”",
    confirmDelete: "Delete template “{name}”?",
    saveAs: "Save as template",
    namePrompt: "Template name:",
    saved: "Template “{name}” saved – you'll find it when creating a new project.",
  },
  export: {
    project: "Export (JSON)",
    all: "Export everything",
  },
  more: "More actions",
  section: {
    title: "Data",
    description:
      "Back up all your projects with their tasks and notes plus your docs as a JSON file – or read such a file back in. Tokens and other secrets are never included.",
    importLabel: "Import file",
    importHint: "Imported projects and pages are always added as new – existing ones are never overwritten.",
    importing: "Importing …",
    imported: "Imported: {projects}, {tasks}, {notes}, {docs}.",
    projects: plural("{n} project", "{n} projects"),
    docs: plural("{n} page", "{n} pages"),
    invalidFile: "The file is not valid JSON.",
  },
  errors: {
    templateNotFound: "This template doesn't exist (anymore).",
    tooManyTemplates: "At most 100 custom templates.",
    format: "This is not a VibeWorks export.",
    version: "The export comes from a newer VibeWorks version – please update first.",
  },
};

export default { de, en };
