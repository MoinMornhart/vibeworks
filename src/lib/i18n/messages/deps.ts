import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „deps“: Abhängigkeiten-Check (npm, Python, Rust, Go, PHP, Gradle/Maven).

const de = {
  title: "Abhängigkeiten",
  checked: "geprüft {ago}",
  check: "Jetzt prüfen",
  checking: "Prüfe …",
  never: "Noch nicht geprüft – das passiert einmal am Tag beim Git-Abgleich oder mit „Jetzt prüfen“.",
  noManifest: "Keine Abhängigkeiten gefunden – geprüft werden package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, composer.json, Gradle und pom.xml.",
  branch: "Zweig",
  otherBranch: "Anderer Zweig: nur zur Ansicht – Aufgaben entstehen nur aus dem Hauptzweig.",
  foundIn: "Gefunden in:",
  allEcosystems: "Alle",
  loadBranches: "Zweige laden",
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
  tasksHint: "Was hier markiert ist, steht automatisch als Aufgabe im Board – und ist erledigt, sobald nichts mehr markiert ist.",
  tasks: {
    vuln: {
      title: plural("Sicherheitslücke beheben: {packages}", "Sicherheitslücken in {n} Paketen beheben: {packages}"),
      intro: "Der Abhängigkeiten-Check hat bekannte Sicherheitslücken gefunden:",
    },
    update: {
      title: plural("Abhängigkeit aktualisieren: {packages}", "{n} Abhängigkeiten aktualisieren: {packages}"),
      intro: "Für diese Pakete gibt es neuere Versionen:",
    },
    auto: "Von VibeWorks angelegt – die Liste hält sich selbst aktuell, und die Aufgabe ist erledigt, sobald nichts mehr markiert ist.",
    label: "abhängigkeiten",
    labelSecurity: "sicherheit",
  },
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
  noManifest: "No dependencies found – checked are package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, composer.json, Gradle and pom.xml.",
  branch: "Branch",
  otherBranch: "Other branch: view only – tasks are only created from the main branch.",
  foundIn: "Found in:",
  allEcosystems: "All",
  loadBranches: "Load branches",
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
  tasksHint: "Whatever is flagged here automatically shows up as a task on the board – and is done as soon as nothing is flagged anymore.",
  tasks: {
    vuln: {
      title: plural("Fix vulnerability: {packages}", "Fix vulnerabilities in {n} packages: {packages}"),
      intro: "The dependency check found known vulnerabilities:",
    },
    update: {
      title: plural("Update dependency: {packages}", "Update {n} dependencies: {packages}"),
      intro: "Newer versions are available for these packages:",
    },
    auto: "Created by VibeWorks – the list keeps itself up to date, and the task is done as soon as nothing is flagged anymore.",
    label: "dependencies",
    labelSecurity: "security",
  },
  errors: {
    noRepo: "No repository is linked to this project.",
    notSynced: "The repository hasn't been synced yet – open “Git & updates” once and try again.",
  },
};

export default { de, en };
