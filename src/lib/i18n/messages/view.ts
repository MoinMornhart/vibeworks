import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „view“: die Seite „Ansicht“ zum Ausblenden nicht gebrauchter Bereiche (#109).

const de = {
  title: "Ansicht",
  subtitle: "Blende aus, was du nicht brauchst. Das gilt nur für dich und lässt sich jederzeit zurücknehmen.",
  hint: "Projekte, Aufgaben und Notizen bleiben immer sichtbar. Ausgeblendetes ist nur weg – es wird nichts gelöscht, und über die Adresse bleibt alles erreichbar.",
  showAll: "Alles anzeigen",
  minimal: "Nur das Nötigste",
  save: "Speichern",
  saved: "Ansicht gespeichert.",
  hiddenCount: plural("{n} Bereich ausgeblendet", "{n} Bereiche ausgeblendet"),
  nothingHidden: "Nichts ausgeblendet – du siehst alles.",
  groups: {
    nav: "Menü",
    dashboard: "Dashboard",
    project: "Projektseite",
  },
  groupHints: {
    nav: "Was oben in der Leiste und im Profilmenü steht.",
    dashboard: "Karten auf der Startseite.",
    project: "Bereiche unterhalb von Aufgaben und Notizen.",
  },
  // Nach Bereichen verschachtelt – der Schlüssel „nav.today“ wird als Pfad gesucht.
  keys: {
    nav: {
      today: "Heute",
      tasks: "Aufgaben",
      prompts: "Prompts",
      review: "Rückblick",
      community: "Community",
      docs: "Docs",
    },
    menu: {
      teams: "Teams",
      inbox: "Ideen-Eingang",
      costs: "Kosten",
    },
    dash: {
      suggestions: "Vorschläge für die Woche",
      sleeping: "Schlafende Projekte",
      shared: "Mit mir geteilte Projekte",
      graveyard: "Link zum Projekt-Friedhof",
    },
    project: {
      live: "Live-Überwachung",
      errors: "Fehler-Eingang",
      structure: "Projektaufbau",
      workflows: "KI-Workflows",
      keys: "Projekt-Schlüssel",
      costs: "Kosten",
      git: "Git & Updates",
      deps: "Abhängigkeiten",
      repoCheck: "Repo-Check",
      ci: "CI-Pipeline",
      lighthouse: "Lighthouse-Check",
      conflicts: "Merge-Konflikte",
      fileFilter: "Dateifilter",
      codeGraph: "Code-Netz",
    },
  },
};

const en: Shape<typeof de> = {
  title: "View",
  subtitle: "Hide what you don't need. This applies only to you and can be undone at any time.",
  hint: "Projects, tasks and notes always stay visible. Hidden parts are only out of sight – nothing is deleted, and everything stays reachable by its address.",
  showAll: "Show everything",
  minimal: "Only the essentials",
  save: "Save",
  saved: "View saved.",
  hiddenCount: plural("{n} area hidden", "{n} areas hidden"),
  nothingHidden: "Nothing hidden – you see everything.",
  groups: {
    nav: "Menu",
    dashboard: "Dashboard",
    project: "Project page",
  },
  groupHints: {
    nav: "What appears in the top bar and the profile menu.",
    dashboard: "Cards on the start page.",
    project: "Sections below tasks and notes.",
  },
  keys: {
    nav: {
      today: "Today",
      tasks: "Tasks",
      prompts: "Prompts",
      review: "Review",
      community: "Community",
      docs: "Docs",
    },
    menu: {
      teams: "Teams",
      inbox: "Idea inbox",
      costs: "Costs",
    },
    dash: {
      suggestions: "Suggestions for the week",
      sleeping: "Sleeping projects",
      shared: "Projects shared with me",
      graveyard: "Link to the project graveyard",
    },
    project: {
      live: "Live monitoring",
      errors: "Error inbox",
      structure: "Project structure",
      workflows: "AI workflows",
      keys: "Project keys",
      costs: "Costs",
      git: "Git & updates",
      deps: "Dependencies",
      repoCheck: "Repo check",
      ci: "CI pipeline",
      lighthouse: "Lighthouse check",
      conflicts: "Merge conflicts",
      fileFilter: "File filter",
      codeGraph: "Code graph",
    },
  },
};

export default { de, en };
