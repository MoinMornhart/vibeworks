import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("Verschlüsselung", () => {
  it("hin und zurück", () => {
    const secret = "ghp_beispiel-token-äöü";
    const box = encrypt(secret);
    expect(box.startsWith("v1.")).toBe(true);
    expect(box).not.toContain(secret);
    expect(decrypt(box)).toBe(secret);
  });

  it("verkürzter oder veränderter Tag wird abgelehnt (#73)", () => {
    const [v, iv, tag, data] = encrypt("geheim").split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decrypt([v, iv, short, data].join("."))).toThrow();
    const flipped = Buffer.from(tag, "base64url");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, flipped.toString("base64url"), data].join("."))).toThrow();
  });
});
