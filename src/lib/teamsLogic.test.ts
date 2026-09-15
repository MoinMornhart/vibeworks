import { describe, expect, it } from "vitest";
import { bestRole, canDemote, leaveOutcome } from "./teamsLogic";

describe("Teams", () => {
  it("die stärkere Rolle gewinnt", () => {
    expect(bestRole([])).toBeNull();
    expect(bestRole(["VIEWER"])).toBe("VIEWER");
    expect(bestRole(["VIEWER", "EDITOR"])).toBe("EDITOR");
    expect(bestRole(["EDITOR", "VIEWER", "VIEWER"])).toBe("EDITOR");
  });
  it("Gehen: letzter Verwalter, letztes Mitglied, normal", () => {
    const team = [
      { userId: "a", manager: true },
      { userId: "b", manager: false },
    ];
    expect(leaveOutcome(team, "b")).toBe("ok");
    expect(leaveOutcome(team, "a")).toBe("lastAdmin");
    expect(leaveOutcome([{ userId: "a", manager: true }], "a")).toBe("lastMember");
    expect(leaveOutcome([...team, { userId: "c", manager: true }], "a")).toBe("ok");
    expect(leaveOutcome(team, "fremd")).toBe("ok");
  });
  it("Verwalten wegnehmen nur mit einem weiteren Verwalter", () => {
    expect(canDemote([{ userId: "a", manager: true }, { userId: "b", manager: false }], "a")).toBe(false);
    expect(canDemote([{ userId: "a", manager: true }, { userId: "b", manager: true }], "a")).toBe(true);
  });
});
