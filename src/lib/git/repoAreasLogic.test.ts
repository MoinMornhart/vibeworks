import { describe, expect, it } from "vitest";
import { tk } from "@/lib/i18n/messages";
import { issuesPaused, ISSUES_RETRY_MS, repoAreas } from "./repoAreasLogic";

const base = { provider: "github", cacheError: null, hasCommits: true, issueSync: true, issuesOffAt: null, ci: { state: "success" }, deps: { manifest: "package.json", error: null } };
const stateOf = (areas: ReturnType<typeof repoAreas>, area: string) => areas.find((a) => a.area === area)?.state;

describe("Bereiche des Repositories (#66)", () => {
  it("abgeschaltete Issues pausieren einen Tag", () => {
    const now = Date.now();
    expect(issuesPaused(new Date(now - 1000), now)).toBe(true);
    expect(issuesPaused(new Date(now - ISSUES_RETRY_MS - 1), now)).toBe(false);
    expect(issuesPaused(null, now)).toBe(false);
  });

  it("alles in Ordnung", () => {
    expect(repoAreas(base).map((a) => a.state)).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("abgeschaltete Issues schränken nur die Issues ein", () => {
    const areas = repoAreas({ ...base, issuesOffAt: new Date() });
    expect(stateOf(areas, "issues")).toBe("limited");
    expect(stateOf(areas, "commits")).toBe("ok");
    expect(areas.find((a) => a.area === "issues")?.note).toBe(tk("git", "areas.issuesDisabled"));
  });

  it("Abgleich-Fehler mit alten Commits ist eingeschränkt, ohne Commits ein Fehler", () => {
    expect(stateOf(repoAreas({ ...base, cacheError: "x" }), "commits")).toBe("limited");
    expect(stateOf(repoAreas({ ...base, cacheError: "x", hasCommits: false }), "commits")).toBe("error");
  });

  it("allgemeine Git-Server kennen weder Issues noch CI", () => {
    expect(repoAreas({ ...base, provider: "git" }).map((a) => a.area)).toEqual(["commits", "deps"]);
  });

  it("Spiegelung aus, keine CI, noch keine Abhängigkeiten", () => {
    const areas = repoAreas({ ...base, issueSync: false, ci: null, deps: null });
    expect([stateOf(areas, "issues"), stateOf(areas, "ci"), stateOf(areas, "deps")]).toEqual(["off", "off", "off"]);
  });
});
