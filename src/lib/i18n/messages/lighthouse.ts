import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „lighthouse“: Lighthouse-Check der Live-Seite (#82).

const de = {
  title: "Lighthouse-Check",
  description: "Einmal pro Woche prüft Lighthouse im kostenlosen GitHub-Runner die Live-Seite: Leistung, Barrierefreiheit, Best Practices und SEO – dazu kaputte Links. Deutliche Verschlechterungen werden zur Aufgabe.",
  off: "Aus – beim Einschalten legt VibeWorks die Datei .github/workflows/vibeworks-lighthouse.yml an (nur Leserechte, kein Zugriff auf den Code).",
  enable: "Einschalten",
  disable: "Ausschalten",
  confirmDisable: "Lighthouse-Check ausschalten? VibeWorks nimmt die Workflow-Datei wieder aus dem Repository.",
  enabled: "Lighthouse-Check eingeschaltet – der erste Lauf startet gleich.",
  disabled: "Lighthouse-Check ausgeschaltet.",
  removed: "Die Workflow-Datei wurde aus dem Repository entfernt.",
  run: "Jetzt prüfen",
  started: "Prüfung gestartet – das dauert ein bis zwei Minuten.",
  noLiveUrl: "Zuerst eine Live-Adresse im Projekt eintragen.",
  noToken: "Für den Workflow braucht das Projekt einen Git-Zugang mit dem Recht „workflow“.",
  status: {
    waiting: "wartet auf den ersten Lauf",
    running: "läuft gerade …",
    done: "geprüft {when}",
    failed: "Lauf fehlgeschlagen",
    noPermission: "keine Berechtigung",
  },
  openRun: "Lauf auf GitHub",
  categories: { performance: "Leistung", accessibility: "Barrierefreiheit", bestPractices: "Best Practices", seo: "SEO" },
  best: "bester Wert: {n}",
  metrics: { lcp: "Größtes Element (LCP)", fcp: "Erster Inhalt (FCP)", tbt: "Blockierzeit (TBT)", cls: "Verschiebung (CLS)" },
  links: {
    title: plural("{n} kaputter Link", "{n} kaputte Links"),
    none: "Keine kaputten Links gefunden.",
    notChecked: "Links nicht geprüft.",
  },
  noReport: "Lighthouse konnte die Seite nicht auswerten.",
  task: {
    title: plural("Live-Seite: {n} Problem ({list})", "Live-Seite: {n} Probleme ({list})"),
    intro: "Der Lighthouse-Check von {url} zeigt deutliche Verschlechterungen gegenüber dem besten bisherigen Wert oder kaputte Links.",
    brokenLink: "kaputter Link ({status})",
    link: "kaputte Links",
    note: "Diese Aufgabe pflegt VibeWorks selbst: Ist alles wieder gut, ist sie erledigt.",
    label: "lighthouse",
  },
  errors: {
    off: "Der Lighthouse-Check ist für dieses Projekt ausgeschaltet.",
    noLiveUrl: "Das Projekt hat keine gültige Live-Adresse (http oder https).",
    githubOnly: "Der Lighthouse-Check braucht ein GitHub-Repository.",
  },
};

const en: Shape<typeof de> = {
  title: "Lighthouse check",
  description: "Once a week Lighthouse checks the live site in the free GitHub runner: performance, accessibility, best practices and SEO – plus broken links. Clear regressions become a task.",
  off: "Off – when you turn it on, VibeWorks adds the file .github/workflows/vibeworks-lighthouse.yml (read-only permissions, no access to the code).",
  enable: "Turn on",
  disable: "Turn off",
  confirmDisable: "Turn off the Lighthouse check? VibeWorks removes the workflow file from the repository.",
  enabled: "Lighthouse check turned on – the first run starts shortly.",
  disabled: "Lighthouse check turned off.",
  removed: "The workflow file was removed from the repository.",
  run: "Check now",
  started: "Check started – this takes a minute or two.",
  noLiveUrl: "Add a live address to the project first.",
  noToken: "The workflow needs a Git access with the “workflow” scope for this project.",
  status: {
    waiting: "waiting for the first run",
    running: "running …",
    done: "checked {when}",
    failed: "run failed",
    noPermission: "no permission",
  },
  openRun: "Run on GitHub",
  categories: { performance: "Performance", accessibility: "Accessibility", bestPractices: "Best practices", seo: "SEO" },
  best: "best so far: {n}",
  metrics: { lcp: "Largest element (LCP)", fcp: "First content (FCP)", tbt: "Blocking time (TBT)", cls: "Layout shift (CLS)" },
  links: {
    title: plural("{n} broken link", "{n} broken links"),
    none: "No broken links found.",
    notChecked: "Links not checked.",
  },
  noReport: "Lighthouse couldn't evaluate the page.",
  task: {
    title: plural("Live site: {n} problem ({list})", "Live site: {n} problems ({list})"),
    intro: "The Lighthouse check of {url} shows clear regressions compared with the best value so far, or broken links.",
    brokenLink: "broken link ({status})",
    link: "broken links",
    note: "VibeWorks maintains this task itself: once everything is fine again, it is done.",
    label: "lighthouse",
  },
  errors: {
    off: "The Lighthouse check is turned off for this project.",
    noLiveUrl: "The project has no valid live address (http or https).",
    githubOnly: "The Lighthouse check needs a GitHub repository.",
  },
};

export default { de, en };
