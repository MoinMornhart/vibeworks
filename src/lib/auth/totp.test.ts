import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUri, totpStep, verifyTotp } from "./totp";

const RFC_KEY = Buffer.from("12345678901234567890");

describe("HOTP/TOTP nach RFC", () => {
  it("RFC 4226 Testvektoren (6 Stellen)", () => {
    expect(["755224", "287082", "359152", "969429", "338314"]).toEqual([0, 1, 2, 3, 4].map((c) => hotp(RFC_KEY, c)));
  });

  it("RFC 6238 Testvektoren (SHA1, 8 Stellen)", () => {
    expect(hotp(RFC_KEY, totpStep(59_000), 8)).toBe("94287082");
    expect(hotp(RFC_KEY, totpStep(1_111_111_109_000), 8)).toBe("07081804");
    expect(hotp(RFC_KEY, totpStep(1_234_567_890_000), 8)).toBe("89005924");
    expect(hotp(RFC_KEY, totpStep(2_000_000_000_000), 8)).toBe("69279037");
  });
});

describe("Base32", () => {
  it("Rundlauf", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });
});

describe("verifyTotp", () => {
  const secret = base32Encode(RFC_KEY);
  const now = 1_700_000_000_000;
  const code = hotp(RFC_KEY, totpStep(now));

  it("nimmt den aktuellen Code und ein Fenster Abweichung", () => {
    expect(verifyTotp(secret, code, null, now)).toBe(totpStep(now));
    expect(verifyTotp(secret, code, null, now + 30_000)).toBe(totpStep(now));
    expect(verifyTotp(secret, code, null, now + 90_000)).toBeNull();
  });

  it("verweigert Wiederverwendung desselben Fensters", () => {
    expect(verifyTotp(secret, code, totpStep(now), now)).toBeNull();
  });

  it("verweigert Unsinn", () => {
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, now)).toBeNull();
  });

  it("baut eine otpauth-Adresse für Authenticator-Apps", () => {
    const uri = otpauthUri("ABC", "morni", "VibeWorks");
    expect(uri.startsWith("otpauth://totp/VibeWorks:morni?")).toBe(true);
    expect(uri).toContain("secret=ABC");
  });
});
