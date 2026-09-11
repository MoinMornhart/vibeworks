import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „grave“: Projekt-Friedhof – schlafende Projekte, Begraben, Grabsteine.

const de = {
  page: {
    title: "Projekt-Friedhof",
    summary: plural("Hier ruht {n} Projekt. Jedes kann wiederbelebt werden.", "Hier ruhen {n} Projekte. Jedes kann wiederbelebt werden."),
    emptyTitle: "Noch niemand begraben",
    emptyHint: "Projekte, die lange schlafen, schlägt dir das Dashboard zum Begraben vor.",
    link: plural("🪦 Projekt-Friedhof · {n} begraben", "🪦 Projekt-Friedhof · {n} begraben"),
  },
  sleeping: {
    title: plural("{n} Projekt schläft", "{n} Projekte schlafen"),
    text: "Seit über {days} Tagen keine Änderung und kein Commit. Weitermachen, später noch mal fragen oder in Frieden ruhen lassen?",
    since: "zuletzt aktiv am {date}",
    continue: "Weitermachen",
    snooze: "Später fragen",
    bury: "Begraben",
  },
  bury: {
    menu: "Begraben …",
    title: "„{name}“ begraben",
    text: "Das Projekt verschwindet vom Dashboard und bekommt einen Grabstein auf dem Friedhof. Nichts wird gelöscht – du kannst es jederzeit wiederbeleben.",
    cause: "Todesursache",
    epitaph: "Letzte Worte (optional)",
    epitaphPlaceholder: "z. B. „War eine gute Idee – für einen Sonntag.“",
    submit: "Begraben",
    cancel: "Abbrechen",
  },
  causes: {
    time: "Keine Zeit",
    better: "Bessere Idee gehabt",
    complex: "Zu kompliziert",
    done: "Hat seinen Zweck erfüllt",
    motivation: "Die Luft war raus",
    other: "Einfach so",
  },
  stone: {
    rip: "Ruhe in Frieden",
    lifespan: plural("{n} Tag alt geworden", "{n} Tage alt geworden"),
    cause: "Todesursache: {cause}",
    epitaph: "„{text}“",
    tasks: "Aufgaben",
    commits: "Commits",
    notes: "Notizen",
    visit: "Ansehen",
    resurrect: "Wiederbeleben",
  },
  header: { buried: "Begraben am {date} – es ruht auf dem Friedhof." },
  errors: {
    alreadyBuried: "Das Projekt ist schon begraben.",
    notBuried: "Das Projekt ist nicht begraben.",
  },
};

const en: Shape<typeof de> = {
  page: {
    title: "Project graveyard",
    summary: plural("{n} project rests here. Each one can be brought back.", "{n} projects rest here. Each one can be brought back."),
    emptyTitle: "Nobody buried yet",
    emptyHint: "The dashboard suggests burying projects that have been asleep for a long time.",
    link: plural("🪦 Project graveyard · {n} buried", "🪦 Project graveyard · {n} buried"),
  },
  sleeping: {
    title: plural("{n} project is asleep", "{n} projects are asleep"),
    text: "No change and no commit for more than {days} days. Carry on, ask again later or let it rest in peace?",
    since: "last active on {date}",
    continue: "Carry on",
    snooze: "Ask later",
    bury: "Bury",
  },
  bury: {
    menu: "Bury …",
    title: "Bury “{name}”",
    text: "The project disappears from the dashboard and gets a tombstone in the graveyard. Nothing is deleted – you can bring it back at any time.",
    cause: "Cause of death",
    epitaph: "Last words (optional)",
    epitaphPlaceholder: "e.g. “It was a good idea – for a Sunday.”",
    submit: "Bury",
    cancel: "Cancel",
  },
  causes: {
    time: "No time",
    better: "Had a better idea",
    complex: "Too complicated",
    done: "Served its purpose",
    motivation: "Ran out of steam",
    other: "Just because",
  },
  stone: {
    rip: "Rest in peace",
    lifespan: plural("Lived {n} day", "Lived {n} days"),
    cause: "Cause of death: {cause}",
    epitaph: "“{text}”",
    tasks: "Tasks",
    commits: "Commits",
    notes: "Notes",
    visit: "View",
    resurrect: "Bring back",
  },
  header: { buried: "Buried on {date} – it rests in the graveyard." },
  errors: {
    alreadyBuried: "The project is already buried.",
    notBuried: "The project is not buried.",
  },
};

export default { de, en };
