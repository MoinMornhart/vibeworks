import { describe, expect, it } from "vitest";
import { addDaysKey, isoWeek, mondayOf, zonedMidnight } from "./weeks";

describe("Wochen", () => {
  it("Montag der Woche", () => {
    expect(mondayOf("2026-09-11")).toBe("2026-09-07"); // Freitag
    expect(mondayOf("2026-09-07")).toBe("2026-09-07"); // Montag selbst
    expect(mondayOf("2026-09-13")).toBe("2026-09-07"); // Sonntag gehört zur selben Woche
  });

  it("Tage addieren über Monatsgrenzen", () => {
    expect(addDaysKey("2026-02-27", 3)).toBe("2026-03-02");
    expect(addDaysKey("2026-09-07", -7)).toBe("2026-08-31");
  });

  it("ISO-Kalenderwoche", () => {
    expect(isoWeek("2026-09-07")).toBe(37);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53); // Freitag gehört noch zur letzten Woche 2026
  });

  it("Mitternacht in Berlin – mit und ohne Sommerzeit", () => {
    expect(zonedMidnight("2026-09-07").toISOString()).toBe("2026-09-06T22:00:00.000Z");
    expect(zonedMidnight("2026-01-05").toISOString()).toBe("2026-01-04T23:00:00.000Z");
    expect(zonedMidnight("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z"); // Tag der Umstellung
  });
});
