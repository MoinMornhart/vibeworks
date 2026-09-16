import { describe, expect, it } from "vitest";
import { betaAllows } from "./betaLogic";

describe("Beta-Ansicht (#68)", () => {
  it("lesen geht immer", () => {
    expect(betaAllows("GET", "/api/projects")).toBe(true);
    expect(betaAllows("head", "/api/tasks/1")).toBe(true);
  });

  it("schreiben ist gesperrt – außer Beenden, Anmelden und Sprache", () => {
    expect(betaAllows("POST", "/api/projects")).toBe(false);
    expect(betaAllows("PATCH", "/api/tasks/1")).toBe(false);
    expect(betaAllows("DELETE", "/api/projects/1")).toBe(false);
    expect(betaAllows("POST", "/api/admin/beta")).toBe(true);
    expect(betaAllows("POST", "/api/admin/beta/")).toBe(true);
    expect(betaAllows("POST", "/api/auth/logout")).toBe(true);
    expect(betaAllows("PUT", "/api/locale")).toBe(true);
    expect(betaAllows("POST", "/api/admin/beta/../users")).toBe(false);
  });
});
