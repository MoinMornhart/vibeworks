import { describe, expect, it } from "vitest";
import { protectedChanges } from "./protect";

const starred = { favorite: true, status: "IN_PROGRESS", repoUrl: "https://github.com/a/b" };

describe("protectedChanges", () => {
  it("ohne Stern ist nichts geschützt", () => {
    expect(protectedChanges({ ...starred, favorite: false }, { status: "DONE", repoUrl: null })).toEqual([]);
  });
  it("Status und Repository mit Stern", () => {
    expect(protectedChanges(starred, { status: "DONE" })).toEqual(["status"]);
    expect(protectedChanges(starred, { repoUrl: null })).toEqual(["repoUrl"]);
    expect(protectedChanges(starred, { status: "DONE", repoUrl: "https://github.com/a/c" })).toEqual(["status", "repoUrl"]);
  });
  it("gleiche Werte oder andere Felder sind frei", () => {
    expect(protectedChanges(starred, { status: "IN_PROGRESS", repoUrl: "https://github.com/a/b" })).toEqual([]);
    expect(protectedChanges(starred, {})).toEqual([]);
  });
});
