import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „notices“: die Meldungen-Seite mit Filtern, Regeln und passenden Aufgaben (#109).

const de = {
  title: "Meldungen",
  subtitle: "Alles, was VibeWorks dir gemeldet hat – mit Filtern und eigenen Regeln.",
  channels: "Kanäle und Anlässe einstellen",
  filters: {
    search: "Suchen",
    searchPlaceholder: "In Titel und Text suchen …",
    event: "Anlass",
    allEvents: "Alle Anlässe",
    unread: "Nur ungelesene",
    count: plural("{n} Meldung", "{n} Meldungen"),
    empty: "Keine Meldungen, die dazu passen.",
    more: "Mehr anzeigen",
  },
  important: "wichtig",
  markRead: "Als gelesen markieren",
  markUnread: "Als ungelesen markieren",
  delete: "Löschen",
  confirmDelete: plural("Diese Meldung löschen?", "{n} Meldungen löschen?"),
  selected: "{n} ausgewählt",
  selectAll: "Alle auswählen",
  rules: {
    title: "Regeln",
    description: "Damit bestimmst du, was dich erreicht. Wichtige Wörter kommen immer durch – auch wenn der Anlass ausgeschaltet ist.",
    words: "Wichtige Wörter",
    wordsHint: "Ein Wort pro Zeile oder mit Komma getrennt. Kommt es in Titel oder Text vor, wird die Meldung hervorgehoben und immer geschickt.",
    people: "Nur von diesen Leuten",
    peopleHint: "Konto- oder Git-Namen. Leer: von allen. Gilt für Meldungen mit Absender, etwa Antworten im Issue.",
    projects: "Nur aus diesen Projekten",
    projectsHint: "Leer: aus allen. Gilt für Meldungen, die zu einem Projekt gehören.",
    save: "Regeln speichern",
    saved: "Regeln gespeichert.",
  },
  tasks: {
    title: "Aufgaben zu deinen Wörtern",
    description: "Offene Aufgaben, in denen eines deiner wichtigen Wörter vorkommt.",
    empty: "Keine offene Aufgabe passt zu deinen Wörtern.",
    none: "Trag oben wichtige Wörter ein, dann stehen hier die passenden Aufgaben.",
  },
};

const en: Shape<typeof de> = {
  title: "Notifications",
  subtitle: "Everything VibeWorks has told you – with filters and your own rules.",
  channels: "Set up channels and events",
  filters: {
    search: "Search",
    searchPlaceholder: "Search title and text …",
    event: "Event",
    allEvents: "All events",
    unread: "Unread only",
    count: plural("{n} notification", "{n} notifications"),
    empty: "No notifications match.",
    more: "Show more",
  },
  important: "important",
  markRead: "Mark as read",
  markUnread: "Mark as unread",
  delete: "Delete",
  confirmDelete: plural("Delete this notification?", "Delete {n} notifications?"),
  selected: "{n} selected",
  selectAll: "Select all",
  rules: {
    title: "Rules",
    description: "This decides what reaches you. Important words always get through – even when the event is switched off.",
    words: "Important words",
    wordsHint: "One word per line or separated by commas. If it appears in the title or text, the notification is highlighted and always sent.",
    people: "Only from these people",
    peopleHint: "Account or Git names. Empty: from everyone. Applies to notifications with a sender, such as replies in an issue.",
    projects: "Only from these projects",
    projectsHint: "Empty: from all. Applies to notifications that belong to a project.",
    save: "Save rules",
    saved: "Rules saved.",
  },
  tasks: {
    title: "Tasks matching your words",
    description: "Open tasks that contain one of your important words.",
    empty: "No open task matches your words.",
    none: "Add important words above and the matching tasks will appear here.",
  },
};

export default { de, en };
