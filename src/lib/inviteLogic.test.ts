import { describe, expect, it } from "vitest";
import { inviteExpiry, inviteStatus, isInviteToken } from "./inviteLogic";
import { registerSchema } from "./validation";

describe("Einladungen", () => {
  const now = Date.parse("2026-09-15T10:00:00Z");
  it("Zustand: offen, genutzt, abgelaufen", () => {
    expect(inviteStatus({ usedAt: null, expiresAt: "2026-09-16T10:00:00Z" }, now)).toBe("open");
    expect(inviteStatus({ usedAt: "2026-09-15T09:00:00Z", expiresAt: "2026-09-16T10:00:00Z" }, now)).toBe("used");
    expect(inviteStatus({ usedAt: null, expiresAt: "2026-09-15T10:00:00Z" }, now)).toBe("expired");
    expect(inviteStatus({ usedAt: "2026-09-10T09:00:00Z", expiresAt: "2026-09-11T10:00:00Z" }, now)).toBe("used");
  });
  it("Laufzeit in Tagen", () => {
    expect(inviteExpiry(7, now).toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });
  it("Registrierung nimmt echte Codes an", () => {
    const base = { username: "bert", password: "lange sichere passphrase 42" };
    expect(registerSchema.safeParse({ ...base, invite: "SeBaFf93yAwKhrsYCBNeU6kEYOhWI1bB" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, invite: "a_b-C9".repeat(6) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, invite: "kein code!" }).success).toBe(false);
    expect(registerSchema.safeParse(base).success).toBe(true);
  });
  it("nur echte Codes", () => {
    expect(isInviteToken("SeBaFf93yAwKhrsYCBNeU6kEYOhWI1bB")).toBe(true);
    expect(isInviteToken("kurz")).toBe(false);
    expect(isInviteToken("../../etc/passwd-aaaaaaaaaaaa")).toBe(false);
  });
});
