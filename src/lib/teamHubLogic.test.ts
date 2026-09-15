import { describe, expect, it } from "vitest";
import { isClaude, sortByProgress, wishesLeft, WISH_LIMIT } from "./teamHubLogic";

describe("Team-Seite", () => {
  it("erkennt Claude – eingetragen oder laut Issue", () => {
    expect(isClaude("Claude")).toBe(true);
    expect(isClaude("claude code")).toBe(true);
    expect(isClaude(null, ["@moinmornhart", "Claude"])).toBe(true);
    expect(isClaude(null, ["@claude"])).toBe(true);
    expect(isClaude("anna", ["@claudia"])).toBe(false);
    expect(isClaude(null)).toBe(false);
  });
  it("laufend vor blockiert vor offen, innerhalb das Neueste zuerst", () => {
    const list = [
      { id: "a", status: "TODO" as const, updatedAt: "2026-09-15T10:00:00Z" },
      { id: "b", status: "DOING" as const, updatedAt: "2026-09-15T09:00:00Z" },
      { id: "c", status: "TODO" as const, updatedAt: "2026-09-15T12:00:00Z" },
      { id: "d", status: "BLOCKED" as const, updatedAt: "2026-09-15T08:00:00Z" },
    ];
    expect(sortByProgress(list).map((x) => x.id)).toEqual(["b", "d", "c", "a"]);
  });
  it("höchstens drei Wünsche am Tag", () => {
    expect(WISH_LIMIT).toBe(3);
    expect(wishesLeft(0)).toBe(3);
    expect(wishesLeft(2)).toBe(1);
    expect(wishesLeft(5)).toBe(0);
  });
});
