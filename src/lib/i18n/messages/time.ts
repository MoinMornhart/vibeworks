import type { Shape } from "../types";

// Namensraum „time“: Zeiterfassung und Fokus-Timer.

const de = {
  start: "Zeit erfassen",
  stop: "Timer stoppen",
  focus: "Fokus 25",
  focusTitle: "Fokus-Timer: 25 Minuten konzentriert an dieser Aufgabe",
  focusLeft: "Fokus – verbleibend",
  focusDone: "Fokus geschafft – Pause! ☕",
  elapsed: "läuft seit {d}",
  tracked: "{d} erfasst",
  today: "{d} erfasst",
  weekTitle: "Zeit diese Woche",
  weekTotal: "{d} insgesamt",
  weekEmpty: "Noch keine Zeit erfasst – starte den Timer an einer Aufgabe.",
};

const en: Shape<typeof de> = {
  start: "Track time",
  stop: "Stop timer",
  focus: "Focus 25",
  focusTitle: "Focus timer: 25 concentrated minutes on this task",
  focusLeft: "Focus – remaining",
  focusDone: "Focus done – take a break! ☕",
  elapsed: "running for {d}",
  tracked: "{d} tracked",
  today: "{d} tracked",
  weekTitle: "Time this week",
  weekTotal: "{d} in total",
  weekEmpty: "No time tracked yet – start the timer on a task.",
};

export default { de, en };
