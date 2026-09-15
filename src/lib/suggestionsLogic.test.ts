import { describe, expect, it } from "vitest";
import { acceptAction, pickSuggestions, suggestionVars, WEIGHT, type Candidate } from "./suggestionsLogic";

describe("suggestionVars", () => {
  it("Kalendertag lesbar, Fehler übersetzt", () => {
    expect(suggestionVars({ date: "2026-09-20", name: "Domain" }, "de", (x) => x)).toMatchObject({ date: "20.09.2026", name: "Domain", error: "" });
    // Englisch nutzt britische Datumsangaben (en-GB)
    expect(suggestionVars({ date: "2026-09-20" }, "en", (x) => x).date).toBe("20/09/2026");
    expect(suggestionVars({ error: "git.errors.x" }, "de", (x) => `übersetzt:${x}`).error).toBe("übersetzt:git.errors.x");
  });
});

const c = (key: string, kind: Candidate["kind"], extra = 0): Candidate => ({ key, kind, projectId: null, score: WEIGHT[kind] + extra, data: {} });

describe("pickSuggestions", () => {
  it("dringend zuerst, höchstens fünf", () => {
    const out = pickSuggestions([c("d1", "describe"), c("v1", "vuln"), c("p1", "plan"), c("ci1", "ci"), c("g1", "git"), c("o", "overdue"), c("s1", "sleeping")], []);
    expect(out.map((x) => x.key)).toEqual(["v1", "ci1", "g1", "o", "s1"]);
  });
  it("höchstens zwei derselben Art", () => {
    const out = pickSuggestions([c("p1", "plan", 3), c("p2", "plan", 2), c("p3", "plan", 1), c("d1", "describe")], []);
    expect(out.map((x) => x.key)).toEqual(["p1", "p2", "d1"]);
  });
  it("Kürzlich entschiedene kommen nicht wieder, Doppelte nur einmal", () => {
    const out = pickSuggestions([c("v1", "vuln"), c("v1", "vuln"), c("ci1", "ci")], ["ci1"]);
    expect(out.map((x) => x.key)).toEqual(["v1"]);
  });
  it("leer bleibt leer", () => {
    expect(pickSuggestions([], [])).toEqual([]);
  });
});

describe("acceptAction", () => {
  it("je Art die passende Aktion", () => {
    expect(acceptAction("overdue")).toBe("today");
    expect(acceptAction("sleeping")).toBe("continue");
    expect(acceptAction("vuln")).toBe("task");
    expect(acceptAction("plan")).toBe("task");
  });
});
