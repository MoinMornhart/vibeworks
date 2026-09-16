import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appJwt, botAppManifest, botAppName, parseConversion, tokenStillFresh, validManifestCode } from "./botAppLogic";

describe("botAppManifest", () => {
  it("verlangt nur Issues und Metadaten, ohne Webhooks", () => {
    const m = botAppManifest("https://vw.example", "Moin");
    expect(m.default_permissions).toEqual({ issues: "write", metadata: "read" });
    expect(m.default_events).toEqual([]);
    expect(m).not.toHaveProperty("hook_attributes");
    expect(m.public).toBe(false);
    expect(m.redirect_url).toBe("https://vw.example/api/account/git-credentials/bot-app/callback");
  });

  it("baut kurze, gültige Namen", () => {
    expect(botAppName("Moin_Mornhart")).toBe("vibeworks-moinmornhart");
    expect(botAppName(null)).toBe("vibeworks-bot");
    expect(botAppName("a".repeat(60)).length).toBeLessThanOrEqual(34);
  });
});

describe("validManifestCode", () => {
  it("lässt nur harmlose Codes durch", () => {
    expect(validManifestCode("abc123_DEF-456")).toBe(true);
    expect(validManifestCode("../../user")).toBe(false);
    expect(validManifestCode("kurz")).toBe(false);
    expect(validManifestCode(undefined)).toBe(false);
  });
});

describe("parseConversion", () => {
  it("nimmt nur vollständige Antworten", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nx\n-----END RSA PRIVATE KEY-----";
    expect(parseConversion({ id: 7, slug: "vibeworks-moin", pem, client_secret: "geheim" })).toEqual({ id: 7, slug: "vibeworks-moin", pem });
    expect(parseConversion({ id: "7", slug: "x", pem })).toBeNull();
    expect(parseConversion({ id: 7, slug: "../x", pem })).toBeNull();
    expect(parseConversion({ id: 7, slug: "x", pem: "kein schlüssel" })).toBeNull();
  });
});

describe("appJwt", () => {
  it("signiert mit RS256 und kurzer Laufzeit", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const jwt = appJwt("123", pem, 1_000_000_000);
    const [head, body, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    expect(claims).toEqual({ iat: 1_000_000 - 60, exp: 1_000_000 + 540, iss: "123" });
    expect(createVerify("RSA-SHA256").update(`${head}.${body}`).verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("tokenStillFresh", () => {
  it("erneuert fünf Minuten vor Ablauf", () => {
    expect(tokenStillFresh(10 * 60_000, 0)).toBe(true);
    expect(tokenStillFresh(4 * 60_000, 0)).toBe(false);
  });
});
