import { describe, expect, it } from "vitest";
import { deviceKeyName, deviceStartSchema, newUserCode, normalizeUserCode, pollResult } from "./deviceAuthLogic";

const now = Date.parse("2026-09-17T14:00:00Z");
const later = new Date(now + 60_000);

describe("Geräte-Anmeldung (#104)", () => {
  it("Codes sind lesbar und eindeutig genug", () => {
    const codes = new Set(Array.from({ length: 500 }, newUserCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  });

  it("Eingabe wird vereinheitlicht, Fremdes abgelehnt", () => {
    expect(normalizeUserCode(" bcdf ghjk ")).toBe("BCDF-GHJK");
    expect(normalizeUserCode("BCDF-GHJ")).toBeNull();
    expect(normalizeUserCode("BCDF-GHJA")).toBeNull(); // Vokal gibt es nicht
    expect(normalizeUserCode("")).toBeNull();
  });

  it("Nachfragen folgen RFC 8628", () => {
    expect(pollResult(null, now)).toEqual({ kind: "error", error: "invalid_grant" });
    expect(pollResult({ status: "pending", expiresAt: later, lastPollAt: null }, now)).toEqual({ kind: "error", error: "authorization_pending" });
    expect(pollResult({ status: "pending", expiresAt: later, lastPollAt: new Date(now - 1000) }, now)).toEqual({ kind: "error", error: "slow_down" });
    expect(pollResult({ status: "pending", expiresAt: new Date(now - 1), lastPollAt: null }, now)).toEqual({ kind: "error", error: "expired_token" });
    expect(pollResult({ status: "denied", expiresAt: later, lastPollAt: null }, now)).toEqual({ kind: "error", error: "access_denied" });
    expect(pollResult({ status: "approved", expiresAt: later, lastPollAt: new Date(now) }, now)).toEqual({ kind: "token" });
    expect(pollResult({ status: "claimed", expiresAt: later, lastPollAt: null }, now)).toEqual({ kind: "error", error: "invalid_grant" });
  });

  it("Start: Name nötig, Umfang standardmäßig „Aufgaben“", () => {
    expect(deviceStartSchema.parse({ client_name: "Julia" }).scope).toBe("tasks");
    expect(deviceStartSchema.safeParse({ client_name: "" }).success).toBe(false);
    expect(deviceStartSchema.safeParse({ client_name: "X", scope: "admin" }).success).toBe(false);
    expect(deviceKeyName("Julia")).toBe("Julia (Gerät)");
  });
});
