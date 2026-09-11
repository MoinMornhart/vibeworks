import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „live“: Live-Überwachung der fertigen Seite eines Projekts.

const de = {
  title: "Live",
  online: "Online · {ms} ms",
  offline: "Offline – ausgefallen {ago}",
  unknown: "Noch nicht geprüft",
  checked: "zuletzt geprüft {ago}",
  checkNow: "Jetzt prüfen",
  checking: "Prüfe …",
  error: "Fehler: {error}",
  uptime: "Erreichbar",
  h24: "24 Std.",
  d7: "7 Tage",
  d30: "30 Tage",
  avgMs: "Ø Antwortzeit (24 Std.)",
  ssl: "Zertifikat",
  sslValid: plural("bis {date} – noch {n} Tag", "bis {date} – noch {n} Tage"),
  sslExpired: "abgelaufen",
  sslNone: "kein HTTPS",
  sslUnknown: "wird geprüft",
  bar: "Letzte 30 Tage",
  barLabel: "Erreichbarkeit der letzten 30 Tage: {pct}",
  dayTitle: "{day}: {pct} erreichbar · Ø {ms} ms",
  dayEmpty: "{day}: keine Messung",
  hint: "VibeWorks prüft die Seite alle 5 Minuten. Offline gilt sie erst nach zwei Fehlversuchen hintereinander.",
  dialog: {
    label: "Live-Adresse (optional)",
    hint: "Die fertige Seite, z. B. https://meine-app.de – VibeWorks prüft sie alle 5 Minuten.",
  },
  card: { up: "Live-Seite online", down: "Live-Seite offline", unknown: "Live-Seite noch nicht geprüft" },
  errors: {
    timeout: "keine Antwort nach 15 Sekunden",
    unreachable: "nicht erreichbar",
    noLiveUrl: "Für dieses Projekt ist keine Live-Adresse eingetragen.",
  },
};

const en: Shape<typeof de> = {
  title: "Live",
  online: "Online · {ms} ms",
  offline: "Offline – down {ago}",
  unknown: "Not checked yet",
  checked: "last checked {ago}",
  checkNow: "Check now",
  checking: "Checking …",
  error: "Error: {error}",
  uptime: "Uptime",
  h24: "24 h",
  d7: "7 days",
  d30: "30 days",
  avgMs: "Avg. response (24 h)",
  ssl: "Certificate",
  sslValid: plural("until {date} – {n} day left", "until {date} – {n} days left"),
  sslExpired: "expired",
  sslNone: "no HTTPS",
  sslUnknown: "being checked",
  bar: "Last 30 days",
  barLabel: "Uptime over the last 30 days: {pct}",
  dayTitle: "{day}: {pct} up · avg. {ms} ms",
  dayEmpty: "{day}: no data",
  hint: "VibeWorks checks the site every 5 minutes. It only counts as down after two failed checks in a row.",
  dialog: {
    label: "Live address (optional)",
    hint: "The finished site, e.g. https://my-app.com – VibeWorks checks it every 5 minutes.",
  },
  card: { up: "Live site online", down: "Live site down", unknown: "Live site not checked yet" },
  errors: {
    timeout: "no response within 15 seconds",
    unreachable: "not reachable",
    noLiveUrl: "No live address is set for this project.",
  },
};

export default { de, en };
