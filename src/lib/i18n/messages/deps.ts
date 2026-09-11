import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „deps“: Abhängigkeiten-Check (package.json).

const de = {
  title: "Abhängigkeiten",
  checked: "geprüft {ago}",
  check: "Jetzt prüfen",
  checking: "Prüfe …",
  never: "Noch nicht geprüft – das passiert einmal am Tag beim Git-Abgleich oder mit „Jetzt prüfen“.",
  noManifest: "Im Repository liegt keine package.json – geprüft werden bisher nur npm-Projekte.",
  failed: "Prüfung fehlgeschlagen: {error}",
  allGood: plural("Alles aktuell – {n} Paket, keine bekannten Sicherheitslücken. 🎉", "Alles aktuell – {n} Pakete, keine bekannten Sicherheitslücken. 🎉"),
  outdated: "{n} von {total} veraltet",
  majorCount: plural("{n} Major", "{n} Major"),
  vulnerable: plural("{n} mit Sicherheitswarnung", "{n} mit Sicherheitswarnung"),
  onlyIssues: "Nur Handlungsbedarf",
  dev: "dev",
  cols: { name: "Paket", current: "Angabe", latest: "Neueste", status: "Status" },
  level: { major: "Major", minor: "Minor", patch: "Patch", current: "aktuell", unknown: "?" },
  severity: { critical: "kritisch", high: "hoch", moderate: "mittel", low: "niedrig", info: "Hinweis" },
  errors: {
    noRepo: "Für dieses Projekt ist kein Repository verknüpft.",
    notSynced: "Das Repository wurde noch nicht abgeglichen – einmal „Git & Updates“ öffnen und es erneut versuchen.",
  },
};

const en: Shape<typeof de> = {
  title: "Dependencies",
  checked: "checked {ago}",
  check: "Check now",
  checking: "Checking …",
  never: "Not checked yet – this happens once a day during the Git sync or with “Check now”.",
  noManifest: "There is no package.json in the repository – only npm projects are checked so far.",
  failed: "Check failed: {error}",
  allGood: plural("All up to date – {n} package, no known vulnerabilities. 🎉", "All up to date – {n} packages, no known vulnerabilities. 🎉"),
  outdated: "{n} of {total} outdated",
  majorCount: plural("{n} major", "{n} major"),
  vulnerable: plural("{n} with a security advisory", "{n} with security advisories"),
  onlyIssues: "Only what needs action",
  dev: "dev",
  cols: { name: "Package", current: "Specified", latest: "Latest", status: "Status" },
  level: { major: "Major", minor: "Minor", patch: "Patch", current: "current", unknown: "?" },
  severity: { critical: "critical", high: "high", moderate: "moderate", low: "low", info: "info" },
  errors: {
    noRepo: "No repository is linked to this project.",
    notSynced: "The repository hasn't been synced yet – open “Git & updates” once and try again.",
  },
};

export default { de, en };
