import { describe, expect, it } from "vitest";
import { bestRole, canDemote, leaveOutcome } from "./teamsLogic";

describe("Teams", () => {
  it("die stärkere Rolle gewinnt", () => {
    expect(bestRole([])).toBeNull();
    expect(bestRole(["VIEWER"])).toBe("VIEWER");
    expect(bestRole(["VIEWER", "EDITOR"])).toBe("EDITOR");
    expect(bestRole(["EDITOR", "VIEWER", "VIEWER"])).toBe("EDITOR");
  });
  it("Gehen: letzter Admin, letztes Mitglied, normal", () => {
    const team = [
      { userId: "a", role: "ADMIN" },
      { userId: "b", role: "MEMBER" },
    ];
    expect(leaveOutcome(team, "b")).toBe("ok");
    expect(leaveOutcome(team, "a")).toBe("lastAdmin");
    expect(leaveOutcome([{ userId: "a", role: "ADMIN" }], "a")).toBe("lastMember");
    expect(leaveOutcome([...team, { userId: "c", role: "ADMIN" }], "a")).toBe("ok");
    expect(leaveOutcome(team, "fremd")).toBe("ok");
  });
  it("herabstufen nur mit einem weiteren Admin", () => {
    expect(canDemote([{ userId: "a", role: "ADMIN" }, { userId: "b", role: "MEMBER" }], "a")).toBe(false);
    expect(canDemote([{ userId: "a", role: "ADMIN" }, { userId: "b", role: "ADMIN" }], "a")).toBe(true);
  });
});
