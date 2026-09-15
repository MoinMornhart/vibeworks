import type { Shape } from "../types";

// Namensraum „slides“: Vorstellungs-Folien eines Projekts.

const de = {
  metaTitle: "{name} – Präsentation",
  present: "Präsentieren",
  deck: "Präsentation",
  by: "von {name}",
  about: "Worum geht's?",
  progress: "Stand",
  tasks: { todo: "offen", doing: "in Arbeit", blocked: "blockiert", done: "erledigt" },
  commits: "Zuletzt passiert",
  live: "Live ansehen",
  nextSteps: "Nächste Schritte",
  thanks: "Danke!",
  openLive: "Zur Live-Seite",
  openCode: "Zum Code",
  hint: "← → blättern · F Vollbild · Esc zurück",
  fullscreen: "Vollbild (F)",
  exitFullscreen: "Vollbild beenden",
  close: "Schließen (Esc)",
  prev: "Vorherige Folie",
  next: "Nächste Folie",
  goTo: "Zu Folie {n}",
};

const en: Shape<typeof de> = {
  metaTitle: "{name} – presentation",
  present: "Present",
  deck: "Presentation",
  by: "by {name}",
  about: "What's it about?",
  progress: "Status",
  tasks: { todo: "open", doing: "in progress", blocked: "blocked", done: "done" },
  commits: "Recently",
  live: "See it live",
  nextSteps: "Next steps",
  thanks: "Thank you!",
  openLive: "Open the live site",
  openCode: "Open the code",
  hint: "← → to navigate · F fullscreen · Esc back",
  fullscreen: "Fullscreen (F)",
  exitFullscreen: "Exit fullscreen",
  close: "Close (Esc)",
  prev: "Previous slide",
  next: "Next slide",
  goTo: "Go to slide {n}",
};

export default { de, en };
