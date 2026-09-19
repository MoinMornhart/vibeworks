import { describe, expect, it } from "vitest";
import { checkMfaEmailCode, MFA_EMAIL_CODE_MINUTES } from "./loginAlert";
import { sha256 } from "@/lib/crypto";

const codeHash = (code: string) => sha256(`vw-mfa-mail:${code.replace(/\D/g, "")}`);

describe("checkMfaEmailCode", () => {
  it("returns true for a correct, fresh code", () => {
    const code = "123456";
    const pending = {
      emailCodeHash: codeHash(code),
      emailCodeAt: new Date(Date.now() - 1000), // 1 second ago
    };
    expect(checkMfaEmailCode(pending, code)).toBe(true);
  });

  it("returns false if emailCodeHash is missing", () => {
    const code = "123456";
    const pending = {
      emailCodeHash: null,
      emailCodeAt: new Date(),
    };
    expect(checkMfaEmailCode(pending, code)).toBe(false);
  });

  it("returns false if emailCodeAt is missing", () => {
    const code = "123456";
    const pending = {
      emailCodeHash: codeHash(code),
      emailCodeAt: null,
    };
    expect(checkMfaEmailCode(pending, code)).toBe(false);
  });

  it("returns false if the code has expired", () => {
    const code = "123456";
    const pending = {
      emailCodeHash: codeHash(code),
      emailCodeAt: new Date(Date.now() - (MFA_EMAIL_CODE_MINUTES + 1) * 60_000),
    };
    expect(checkMfaEmailCode(pending, code)).toBe(false);
  });

  it("returns false if the code is incorrect", () => {
    const code = "123456";
    const wrongCode = "654321";
    const pending = {
      emailCodeHash: codeHash(code),
      emailCodeAt: new Date(),
    };
    expect(checkMfaEmailCode(pending, wrongCode)).toBe(false);
  });
});
