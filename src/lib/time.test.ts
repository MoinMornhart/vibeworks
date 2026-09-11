import { describe, expect, it } from "vitest";
import { entrySeconds, focusRemaining, formatClock, formatDuration, MAX_ENTRY_SECONDS } from "./time";

describe("Zeiterfassung", () => {
  const start = new Date("2026-09-12T10:00:00Z");

  it("Dauer, auch laufend, höchstens zwölf Stunden", () => {
    expect(entrySeconds(start, new Date("2026-09-12T10:25:30Z"))).toBe(1530);
    expect(entrySeconds(start, null, new Date("2026-09-12T10:01:00Z"))).toBe(60);
    expect(entrySeconds(start, new Date("2026-09-13T10:00:00Z"))).toBe(MAX_ENTRY_SECONDS);
    expect(entrySeconds(start, new Date("2026-09-12T09:00:00Z"))).toBe(0);
  });

  it("Anzeige", () => {
    expect(formatDuration(40)).toBe("40 s");
    expect(formatDuration(12 * 60 + 10)).toBe("12 min");
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe("2 h 05 min");
    expect(formatClock(754)).toBe("12:34");
    expect(formatClock(3723)).toBe("1:02:03");
  });

  it("Fokus-Rest", () => {
    expect(focusRemaining(start, 25, new Date("2026-09-12T10:20:00Z"))).toBe(300);
    expect(focusRemaining(start, 25, new Date("2026-09-12T10:26:00Z"))).toBe(-60);
  });
});
