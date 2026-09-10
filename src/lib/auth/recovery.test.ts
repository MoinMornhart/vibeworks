import { describe, expect, it } from "vitest";
import { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode } from "./recovery";

describe("Wiederherstellungscodes", () => {
  it("haben ein lesbares Format ohne verwechselbare Zeichen", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
      expect(code).not.toMatch(/[lo01i]/);
    }
  });

  it("sind beim Eintippen tolerant", () => {
    expect(normalizeRecoveryCode(" ABCDE-fghjk ")).toBe("abcdefghjk");
    expect(hashRecoveryCode("abcde-fghjk")).toBe(hashRecoveryCode("ABCDE FGHJK"));
  });

  it("sind praktisch nie doppelt", () => {
    const set = new Set(Array.from({ length: 1000 }, generateRecoveryCode));
    expect(set.size).toBe(1000);
  });
});
