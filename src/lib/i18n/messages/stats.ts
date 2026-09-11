import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „stats“: Aktivitätsgitter, Serien und Erfolge im Rückblick.

const de = {
  title: "Aktivität",
  subtitle: "Das letzte Jahr – dein Verlauf und die Commits deiner Projekte",
  current: "Aktuelle Serie",
  longest: "Längste Serie",
  activeDays: "Aktive Tage",
  days: plural("{n} Tag", "{n} Tage"),
  cell: plural("{date}: {n} Ereignis", "{date}: {n} Ereignisse"),
  cellNone: "{date}: nichts",
  aria: "Aktivität im letzten Jahr: {days} aktive Tage, {total} Ereignisse",
  less: "weniger",
  more: "mehr",
  achievements: "Erfolge",
  unlocked: "{n} von {total} freigeschaltet",
  a: {
    firstProject: { title: "Erste Idee", text: "Ein Projekt angelegt" },
    ideas: { title: "Ideenschmiede", text: "{n} Projekte angelegt" },
    shipped: { title: "Ausgeliefert", text: "Ein Projekt auf „Fertig“ gebracht" },
    tasks10: { title: "Macher", text: "{n} Aufgaben erledigt" },
    tasks100: { title: "Aufgaben-Profi", text: "{n} Aufgaben erledigt" },
    streak7: { title: "Serienheld", text: "{n} Tage am Stück aktiv" },
    streak30: { title: "Marathon", text: "{n} Tage am Stück aktiv" },
    git: { title: "Verkabelt", text: "Ein Repository verknüpft" },
    live: { title: "Live gegangen", text: "Eine Live-Seite ist online" },
    writer: { title: "Dokumentar", text: "{n} Notizen und Docs geschrieben" },
    gardener: { title: "Friedhofsgärtner", text: "Ein Projekt in Frieden ruhen lassen" },
  },
};

const en: Shape<typeof de> = {
  title: "Activity",
  subtitle: "The last year – your activity and the commits of your projects",
  current: "Current streak",
  longest: "Longest streak",
  activeDays: "Active days",
  days: plural("{n} day", "{n} days"),
  cell: plural("{date}: {n} event", "{date}: {n} events"),
  cellNone: "{date}: nothing",
  aria: "Activity over the last year: {days} active days, {total} events",
  less: "less",
  more: "more",
  achievements: "Achievements",
  unlocked: "{n} of {total} unlocked",
  a: {
    firstProject: { title: "First idea", text: "Created a project" },
    ideas: { title: "Idea forge", text: "Created {n} projects" },
    shipped: { title: "Shipped", text: "Brought a project to “Done”" },
    tasks10: { title: "Doer", text: "Completed {n} tasks" },
    tasks100: { title: "Task pro", text: "Completed {n} tasks" },
    streak7: { title: "Streak hero", text: "Active {n} days in a row" },
    streak30: { title: "Marathon", text: "Active {n} days in a row" },
    git: { title: "Wired up", text: "Linked a repository" },
    live: { title: "Gone live", text: "A live site is online" },
    writer: { title: "Chronicler", text: "Wrote {n} notes and docs" },
    gardener: { title: "Graveyard keeper", text: "Let a project rest in peace" },
  },
};

export default { de, en };
