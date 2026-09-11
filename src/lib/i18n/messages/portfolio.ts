import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „portfolio“: öffentliches Portfolio.

const de = {
  section: {
    title: "Öffentliches Portfolio",
    description: "Eine Seite zum Herzeigen: ausgewählte Projekte mit Stand und Links – ohne Anmeldung sichtbar. Notizen, Aufgaben und alles andere bleiben privat.",
  },
  public: "Portfolio öffentlich zeigen",
  publicHint: "Ausgeschaltet gibt es die Seite nicht – wer die Adresse kennt, sieht dann nur „nicht gefunden“.",
  copy: "Kopieren",
  copied: "Kopiert",
  open: "Ansehen",
  bio: "Über dich (Markdown, optional)",
  bioPlaceholder: "z. B. Ich baue gern kleine Tools für den Alltag – am liebsten mit Claude.",
  projects: plural("Projekte – {n} ausgewählt", "Projekte – {n} ausgewählt"),
  noProjects: "Noch keine Projekte.",
  save: "Speichern",
  saved: "Gespeichert.",
  page: {
    badge: "Öffentliches Portfolio",
    stats: plural("{n} Projekt · {done} fertig", "{n} Projekte · {done} fertig"),
    empty: "Hier ist noch nichts ausgestellt.",
    live: "Live",
    code: "Code",
    details: "Details",
    footer: "Erstellt mit {app}",
    metaTitle: "{name} – Portfolio",
  },
};

const en: Shape<typeof de> = {
  section: {
    title: "Public portfolio",
    description: "A page to show off: selected projects with status and links – visible without signing in. Notes, tasks and everything else stay private.",
  },
  public: "Show portfolio publicly",
  publicHint: "When off, the page doesn't exist – anyone with the address just sees “not found”.",
  copy: "Copy",
  copied: "Copied",
  open: "View",
  bio: "About you (Markdown, optional)",
  bioPlaceholder: "e.g. I like building small everyday tools – preferably with Claude.",
  projects: plural("Projects – {n} selected", "Projects – {n} selected"),
  noProjects: "No projects yet.",
  save: "Save",
  saved: "Saved.",
  page: {
    badge: "Public portfolio",
    stats: plural("{n} project · {done} done", "{n} projects · {done} done"),
    empty: "Nothing on display yet.",
    live: "Live",
    code: "Code",
    details: "Details",
    footer: "Made with {app}",
    metaTitle: "{name} – Portfolio",
  },
};

export default { de, en };
