import { describe, expect, it } from "vitest";
import { demoAllows, demoMayReset, lastResetMark } from "./demoGuard";

describe("lastResetMark", () => {
  it("nach 3 Uhr Berlin: heute 3 Uhr (Sommerzeit)", () => {
    expect(lastResetMark(new Date("2026-09-13T01:30:00Z")).toISOString()).toBe("2026-09-13T01:00:00.000Z");
  });
  it("vor 3 Uhr Berlin: gestern 3 Uhr", () => {
    expect(lastResetMark(new Date("2026-09-13T00:30:00Z")).toISOString()).toBe("2026-09-12T01:00:00.000Z");
  });
  it("Winterzeit", () => {
    expect(lastResetMark(new Date("2026-12-01T02:30:00Z")).toISOString()).toBe("2026-12-01T02:00:00.000Z");
    expect(lastResetMark(new Date("2026-12-01T01:59:00Z")).toISOString()).toBe("2026-11-30T02:00:00.000Z");
  });
});

describe("demoAllows", () => {
  it("lässt Lesen immer zu", () => {
    expect(demoAllows("GET", "/api/projects")).toBe(true);
    expect(demoAllows("HEAD", "/api/projects/abc")).toBe(true);
    expect(demoAllows("OPTIONS", "/api/mcp")).toBe(true);
  });

  it("sperrt jedes Schreiben", () => {
    for (const [method, path] of [
      ["POST", "/api/projects"],
      ["PATCH", "/api/tasks/abc"],
      ["DELETE", "/api/projects/abc"],
      ["PUT", "/api/account/theme"],
      ["POST", "/api/auth/setup"],
      ["POST", "/api/auth/register"],
      ["POST", "/api/auth/passkey/register/verify"],
      ["POST", "/api/account/api-tokens"],
      ["POST", "/api/inbox/in/geheim"],
      ["POST", "/api/webhooks/git/abc"],
      ["POST", "/api/admin/update"],
    ]) {
      expect(demoAllows(method, path), `${method} ${path}`).toBe(false);
    }
  });

  it("erlaubt Demo-Anmeldung, Anmelden, Abmelden und Sprache", () => {
    expect(demoAllows("POST", "/api/auth/demo")).toBe(true);
    expect(demoAllows("POST", "/api/auth/login/")).toBe(true);
    expect(demoAllows("post", "/api/auth/logout")).toBe(true);
    expect(demoAllows("PUT", "/api/locale")).toBe(true);
  });

  it("kein Umweg über ähnliche Pfade", () => {
    expect(demoAllows("POST", "/api/auth/demox")).toBe(false);
    expect(demoAllows("POST", "/api/locale/x")).toBe(false);
    expect(demoAllows("POST", "/api/auth")).toBe(false);
  });
});

describe("demoMayReset", () => {
  it("leer oder nur das Demo-Konto: ja", () => {
    expect(demoMayReset([])).toBe(true);
    expect(demoMayReset(["demo"])).toBe(true);
  });
  it("sobald ein echtes Konto existiert: nie", () => {
    expect(demoMayReset(["demo", "morni"])).toBe(false);
    expect(demoMayReset(["morni"])).toBe(false);
  });
});
