import { describe, expect, it } from "vitest";
import { passwordReminderDue } from "./passwordAge";
import { hasSpecial } from "./passwordRules";

const DAY = 86_400_000;
const now = new Date("2026-09-16T10:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);

describe("Passwort-Erinnerung", () => {
  it("fällig erst nach den eingestellten Tagen", () => {
    expect(passwordReminderDue({ changedAt: ago(179), createdAt: ago(400), days: 180, remindedAt: null }, now)).toBeNull();
    expect(passwordReminderDue({ changedAt: ago(181), createdAt: ago(400), days: 180, remindedAt: null }, now)).toBe(181);
  });
  it("aus heißt nie", () => {
    expect(passwordReminderDue({ changedAt: ago(999), createdAt: ago(999), days: 0, remindedAt: null }, now)).toBeNull();
  });
  it("ohne Änderungsdatum zählt die Anlage des Kontos", () => {
    expect(passwordReminderDue({ changedAt: null, createdAt: ago(200), days: 180, remindedAt: null }, now)).toBe(200);
  });
  it("höchstens alle 30 Tage erinnern", () => {
    expect(passwordReminderDue({ changedAt: ago(400), createdAt: ago(400), days: 90, remindedAt: ago(10) }, now)).toBeNull();
    expect(passwordReminderDue({ changedAt: ago(400), createdAt: ago(400), days: 90, remindedAt: ago(31) }, now)).toBe(400);
  });
});

describe("Sonderzeichen", () => {
  it("Leerzeichen und Satzzeichen zählen, Buchstaben und Ziffern nicht", () => {
    expect(hasSpecial("pferd batterie")).toBe(true);
    expect(hasSpecial("passwort-lang")).toBe(true);
    expect(hasSpecial("ÄrgerlichLang123")).toBe(false);
  });
});
