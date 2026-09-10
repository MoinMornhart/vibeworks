import { describe, expect, it } from "vitest";
import { addStep, derivedProgress, dueState, formatDue, isDayKey, nextDueKey } from "./taskDates";

describe("Wiederholung", () => {
  it("monatlich behält den Tag und kappt am Monatsende", () => {
    expect(addStep("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(addStep("2026-01-31", "MONTHLY", 2)).toBe("2026-03-31");
    expect(addStep("2028-01-31", "MONTHLY")).toBe("2028-02-29");
    expect(addStep("2026-12-15", "MONTHLY")).toBe("2027-01-15");
  });

  it("täglich, wöchentlich, zweiwöchentlich", () => {
    expect(addStep("2026-02-28", "DAILY")).toBe("2026-03-01");
    expect(addStep("2026-09-07", "WEEKLY")).toBe("2026-09-14");
    expect(addStep("2026-09-07", "BIWEEKLY")).toBe("2026-09-21");
  });

  it("rechnet vom Fälligkeitsdatum, nicht vom Abhaken", () => {
    // Montag fällig, am Donnerstag erledigt → nächster Montag
    expect(nextDueKey("2026-09-07", "WEEKLY", "2026-09-10")).toBe("2026-09-14");
    // noch nicht fällig → einfach ein Schritt weiter
    expect(nextDueKey("2026-09-20", "WEEKLY", "2026-09-10")).toBe("2026-09-27");
  });

  it("rückt lange Liegengebliebenes in die Zukunft", () => {
    expect(nextDueKey("2026-01-05", "WEEKLY", "2026-09-10")).toBe("2026-09-14");
    expect(nextDueKey("2026-01-31", "MONTHLY", "2026-09-10")).toBe("2026-09-30");
  });

  it("ohne Fälligkeit zählt heute", () => {
    expect(nextDueKey(null, "DAILY", "2026-09-10")).toBe("2026-09-11");
  });
});

describe("Fälligkeit", () => {
  it("Kalendertage statt Stunden", () => {
    expect(dueState("2026-09-09", "2026-09-10")).toBe("overdue");
    expect(dueState("2026-09-10", "2026-09-10")).toBe("today");
    expect(dueState("2026-09-13", "2026-09-10")).toBe("soon");
    expect(dueState("2026-09-20", "2026-09-10")).toBe("later");
  });

  it("verständliche Texte", () => {
    expect(formatDue("2026-09-10", "2026-09-10")).toBe("heute");
    expect(formatDue("2026-09-11", "2026-09-10")).toBe("morgen");
    expect(formatDue("2026-09-07", "2026-09-10")).toBe("seit 3 Tagen");
    expect(formatDue("2026-10-24", "2026-09-10")).toBe("24.10.");
  });

  it("erkennt gültige Tage", () => {
    expect(isDayKey("2026-09-10")).toBe(true);
    expect(isDayKey("10.09.2026")).toBe(false);
  });
});

describe("Fortschritt aus Aufgaben", () => {
  it("Anteil erledigter Aufgaben", () => {
    expect(derivedProgress(8, 3)).toBe(38);
    expect(derivedProgress(0, 0)).toBe(0);
    expect(derivedProgress(4, 4)).toBe(100);
  });
});
