import { describe, expect, it } from "vitest";
import { maskEmail, resetExpiry, resetUsable, RESET_TTL_MS } from "./resetLogic";

const now = new Date("2026-09-16T10:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);

describe("Passwort vergessen", () => {
  it("Link gilt eine Stunde", () => {
    expect(resetExpiry(now).getTime() - now.getTime()).toBe(RESET_TTL_MS);
    expect(resetUsable({ expiresAt: at(60_000), usedAt: null }, now)).toBe(true);
    expect(resetUsable({ expiresAt: at(-1), usedAt: null }, now)).toBe(false);
  });
  it("nur einmal nutzbar, unbekannter Link zählt nicht", () => {
    expect(resetUsable({ expiresAt: at(60_000), usedAt: at(-500) }, now)).toBe(false);
    expect(resetUsable(null, now)).toBe(false);
  });
  it("Adresse wird maskiert", () => {
    expect(maskEmail("moinmornhart@example.de")).toBe("m…t@example.de");
    expect(maskEmail("ab@example.de")).toBe("a…@example.de");
    expect(maskEmail("kaputt")).toBe("…");
  });
});
