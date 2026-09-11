import { describe, expect, it } from "vitest";
import { isCause, lastSign, lifespanDays } from "./grave";

describe("Projekt-Friedhof", () => {
  it("letztes Lebenszeichen: das Spätere aus Änderung und Commits", () => {
    const updated = new Date("2026-06-01T10:00:00Z");
    expect(lastSign(updated, null)).toEqual(updated);
    expect(lastSign(updated, [{ date: "2026-05-01T00:00:00Z" }])).toEqual(updated);
    expect(lastSign(updated, [{ date: "2026-07-02T08:00:00Z" }, { date: "kaputt" }, null])).toEqual(new Date("2026-07-02T08:00:00Z"));
  });

  it("Lebensdauer in Tagen, mindestens einer", () => {
    expect(lifespanDays("2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z")).toBe(30);
    expect(lifespanDays("2026-01-01T00:00:00Z", "2026-01-01T02:00:00Z")).toBe(1);
  });

  it("nur bekannte Todesursachen", () => {
    expect(isCause("time")).toBe(true);
    expect(isCause("meteor")).toBe(false);
  });
});
