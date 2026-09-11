import type { Shape } from "../types";

// Namensraum „mcp“: API-Schlüssel für Claude Code und Meldungen des MCP-Servers.

const de = {
  section: {
    title: "Claude Code & API-Schlüssel",
    description: "Mit einem API-Schlüssel arbeitet Claude Code (oder ein anderer MCP-Client) direkt mit deinen Projekten, Aufgaben, Notizen und Docs – mit deinen Rechten.",
  },
  can: "Claude kann damit Projekte und Aufgaben lesen, Aufgaben anlegen und verschieben (Issues laufen mit), Notizen und Docs lesen und schreiben und alles durchsuchen.",
  name: "Name des Schlüssels",
  namePlaceholder: "z. B. Laptop – Claude Code",
  create: "Schlüssel erstellen",
  creating: "Erstelle …",
  fresh: {
    title: "Schlüssel „{name}“ erstellt",
    once: "Er wird nur jetzt angezeigt. Am einfachsten gleich den ganzen Befehl kopieren und im Terminal ausführen:",
    tryIt: "Danach in Claude Code zum Beispiel: „Welche Aufgaben sind in VibeWorks offen?“",
    other: "Andere MCP-Clients: Adresse {url} (Streamable HTTP) mit dem Header Authorization: Bearer <Schlüssel>.",
    key: "Nur der Schlüssel",
    done: "Fertig",
  },
  copy: "Kopieren",
  copied: "Kopiert",
  empty: "Noch keine Schlüssel.",
  lastUsed: "zuletzt benutzt {ago}",
  neverUsed: "noch nie benutzt",
  created: "erstellt {ago}",
  revoke: "Widerrufen",
  revokeConfirm: "Wirklich widerrufen?",
  cancel: "Abbrechen",
  errors: {
    limit: "Höchstens {n} Schlüssel je Konto.",
    notFound: "Schlüssel nicht gefunden.",
    nameMissing: "Bitte einen Namen angeben.",
    unauthorized: "Ungültiger oder widerrufener API-Schlüssel.",
    ambiguous: "Mehrere Projekte heißen „{name}“ – bitte die ID angeben.",
    docNotFound: "Doc-Seite nicht gefunden.",
    noteNotFound: "Notiz nicht gefunden.",
  },
};

const en: Shape<typeof de> = {
  section: {
    title: "Claude Code & API keys",
    description: "With an API key, Claude Code (or any other MCP client) works directly with your projects, tasks, notes and docs – with your permissions.",
  },
  can: "Claude can read projects and tasks, create and move tasks (issues follow along), read and write notes and docs, and search everything.",
  name: "Key name",
  namePlaceholder: "e.g. Laptop – Claude Code",
  create: "Create key",
  creating: "Creating …",
  fresh: {
    title: "Key “{name}” created",
    once: "It is only shown now. Easiest is to copy the whole command and run it in a terminal:",
    tryIt: "Then ask Claude Code, for example: “Which tasks are open in VibeWorks?”",
    other: "Other MCP clients: address {url} (Streamable HTTP) with the header Authorization: Bearer <key>.",
    key: "Key only",
    done: "Done",
  },
  copy: "Copy",
  copied: "Copied",
  empty: "No keys yet.",
  lastUsed: "last used {ago}",
  neverUsed: "never used",
  created: "created {ago}",
  revoke: "Revoke",
  revokeConfirm: "Really revoke?",
  cancel: "Cancel",
  errors: {
    limit: "At most {n} keys per account.",
    notFound: "Key not found.",
    nameMissing: "Please enter a name.",
    unauthorized: "Invalid or revoked API key.",
    ambiguous: "Several projects are called “{name}” – please use the ID.",
    docNotFound: "Doc page not found.",
    noteNotFound: "Note not found.",
  },
};

export default { de, en };
