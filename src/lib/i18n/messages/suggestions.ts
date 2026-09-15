import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „suggestions“: Wochen-Vorschläge auf dem Dashboard.

const de = {
  title: "Vorschläge für diese Woche",
  hint: "Aus deinen Projekten zusammengestellt – ohne KI. Annehmen legt meist eine Aufgabe an.",
  accept: "Annehmen",
  dismiss: "Ablehnen",
  dismissLabel: "Vorschlag „{title}“ ablehnen",
  accepted: "Angenommen",
  openProject: "Zum Projekt",
  toToday: "Zu Heute",
  fromSuggestions: "Aus den Wochen-Vorschlägen von VibeWorks.",
  kinds: {
    vuln: { title: "Sicherheitslücke in {project}", detail: "Bekannte Lücken in: {packages}.", task: "Sicherheitslücken beheben: {packages}" },
    ci: { title: "Die CI von {project} ist rot", detail: "Fehlgeschlagen: {runs}.", task: "CI reparieren: {runs}" },
    git: { title: "{project} lässt sich nicht mit Git abgleichen", detail: "{error}", task: "Git-Zugang prüfen" },
    renewal: { title: "Verlängerung: {name} ({project})", detail: "Am {date} für {amount}.", task: "Verlängerung prüfen: {name}" },
    overdue: { title: plural("{n} Aufgabe ist überfällig", "{n} Aufgaben sind überfällig"), detail: "Annehmen merkt sie für heute vor.", task: "" },
    sleeping: { title: "{project} schläft seit {days} Tagen", detail: "Annehmen heißt: weitermachen – der Friedhof fragt dann 30 Tage nicht.", task: "" },
    major: { title: "Große Updates für {project}", detail: "{packages}", task: "Abhängigkeiten aktualisieren: {packages}" },
    plan: { title: "{project} hat keine offenen Aufgaben", detail: "Ein nächster Schritt hilft beim Dranbleiben.", task: "Nächste Schritte planen" },
    describe: { title: "{project} hat noch keine Beschreibung", detail: "Eine Beschreibung zählt für den Fortschritt und hilft Claude beim Verstehen.", task: "Beschreibung schreiben" },
  },
  errors: {
    notFound: "Vorschlag nicht gefunden",
    decided: "Über diesen Vorschlag wurde schon entschieden.",
  },
};

const en: Shape<typeof de> = {
  title: "Suggestions for this week",
  hint: "Put together from your projects – no AI. Accepting usually creates a task.",
  accept: "Accept",
  dismiss: "Dismiss",
  dismissLabel: "Dismiss suggestion “{title}”",
  accepted: "Accepted",
  openProject: "Open project",
  toToday: "Go to Today",
  fromSuggestions: "From VibeWorks' weekly suggestions.",
  kinds: {
    vuln: { title: "Vulnerability in {project}", detail: "Known vulnerabilities in: {packages}.", task: "Fix vulnerabilities: {packages}" },
    ci: { title: "{project}'s CI is red", detail: "Failed: {runs}.", task: "Fix CI: {runs}" },
    git: { title: "{project} can't sync with Git", detail: "{error}", task: "Check Git access" },
    renewal: { title: "Renewal: {name} ({project})", detail: "On {date} for {amount}.", task: "Check renewal: {name}" },
    overdue: { title: plural("{n} task is overdue", "{n} tasks are overdue"), detail: "Accepting puts them on today's list.", task: "" },
    sleeping: { title: "{project} has been asleep for {days} days", detail: "Accepting means: carry on – the graveyard won't ask for 30 days.", task: "" },
    major: { title: "Major updates for {project}", detail: "{packages}", task: "Update dependencies: {packages}" },
    plan: { title: "{project} has no open tasks", detail: "A next step helps you keep going.", task: "Plan next steps" },
    describe: { title: "{project} has no description yet", detail: "A description counts towards progress and helps Claude understand it.", task: "Write a description" },
  },
  errors: {
    notFound: "Suggestion not found",
    decided: "This suggestion has already been decided.",
  },
};

export default { de, en };
