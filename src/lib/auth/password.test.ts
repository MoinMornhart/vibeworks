import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";

describe("Passwort-Hashing", () => {
  it("prüft richtig und falsch", async () => {
    const hash = await hashPassword("ein langes Passwort");
    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect((await verifyPassword("ein langes Passwort", hash)).ok).toBe(true);
    expect((await verifyPassword("ein anderes Passwort", hash)).ok).toBe(false);
  });

  it("verwendet unterschiedliches Salz", async () => {
    expect(await hashPassword("gleiches-passwort")).not.toBe(await hashPassword("gleiches-passwort"));
  });

  it("lehnt kaputte Hashes ab statt zu werfen", async () => {
    expect((await verifyPassword("x", "kaputt")).ok).toBe(false);
    expect((await verifyPassword("x", "scrypt$a$b$c$d$e")).ok).toBe(false);
  });
});

describe("Passwortregeln", () => {
  it.each([
    ["kurz", "Mindestens"],
    ["1234567890123", "Ziffern"],
    ["abababababab", "verschiedene"],
    ["abcdefghijkl", "durchlaufende"],
    ["passwort123", "naheliegend"],
    ["morni-ist-toll", "Benutzernamen"],
  ])("%s wird abgelehnt", (pw, grund) => {
    expect(checkPasswordPolicy(pw, "morni")).toContain(grund);
  });

  it("akzeptiert eine lange Passphrase ohne Sonderzeichen", () => {
    expect(checkPasswordPolicy("pferd batterie heftklammer", "morni")).toBeNull();
  });
});
