import { describe, expect, it } from "vitest";
import { authorizeSchema, authorizeView, newAuthorizationCode, newClientId, oauthMetadata, oauthReturnUrl, protectedResourceMetadata, s256Challenge, tokenResult, validRedirectUris } from "./oauthFlowLogic";

describe("oauthMetadata", () => {
  it("werbt S256 als Challenge-Methode – genau das prüft ChatGPT (#141)", () => {
    const m = oauthMetadata("https://vw.example/");
    expect(m.code_challenge_methods_supported).toContain("S256");
    expect(m.grant_types_supported).toEqual(["authorization_code"]);
    expect(m.response_types_supported).toEqual(["code"]);
    expect(m.authorization_endpoint).toBe("https://vw.example/api/mcp/oauth/authorize");
    expect(m.token_endpoint).toBe("https://vw.example/api/mcp/oauth/token");
    expect(m.registration_endpoint).toBe("https://vw.example/api/mcp/oauth/register");
    expect(m.issuer).toBe("https://vw.example");
  });
});

describe("protectedResourceMetadata", () => {
  it("nennt diesen Server als Autorisierungsserver", () => {
    const m = protectedResourceMetadata("https://vw.example");
    expect(m.authorization_servers).toEqual(["https://vw.example"]);
  });
});

describe("validRedirectUris", () => {
  it("nur https, localhost auch über http", () => {
    expect(validRedirectUris(["https://chatgpt.com/connector_platform_oauth_redirect"])).toBe(true);
    expect(validRedirectUris(["http://localhost:1455/auth/callback"])).toBe(true);
    expect(validRedirectUris(["http://evil.example/callback"])).toBe(false);
    expect(validRedirectUris(["nicht einmal eine url"])).toBe(false);
  });
});

describe("s256Challenge", () => {
  it("folgt RFC 7636 Beispielrechnung", () => {
    // Bekanntes Beispiel-Verifier-Ergebnis aus RFC 7636 Appendix B
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(s256Challenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("kennungen", () => {
  it("Client- und Autorisierungs-Codes haben genug Zufall", () => {
    expect(newClientId()).toMatch(/^app_[A-Za-z0-9]{18}$/);
    expect(newAuthorizationCode().length).toBe(32);
    expect(newAuthorizationCode()).not.toBe(newAuthorizationCode());
  });
});

describe("tokenResult", () => {
  const pending = { status: "pending", codeChallenge: s256Challenge("verifier-verifier-verifier-verifier-verifier1234"), expiresAt: new Date(Date.now() + 60_000), redirectUri: "https://cli/callback" };
  const input = { code_verifier: "verifier-verifier-verifier-verifier-verifier1234", redirect_uri: "https://cli/callback", client_id: "app_abc" };

  it("gibt aus: freigegeben, passender Verifier, Client und Redirect", () => {
    expect(tokenResult({ ...pending, status: "approved" }, input, "app_abc")).toEqual({ kind: "token" });
  });

  it("lehnt ab: falscher Verifier (PKCE), falscher Redirect, falscher Client", () => {
    expect(tokenResult({ ...pending, status: "approved" }, { ...input, code_verifier: "falsch-falsch-falsch-falsch-falsch-falsch12" }, "app_abc")).toEqual({ kind: "error", error: "invalid_grant" });
    expect(tokenResult({ ...pending, status: "approved" }, { ...input, redirect_uri: "https://other/callback" }, "app_abc")).toEqual({ kind: "error", error: "invalid_grant" });
    expect(tokenResult({ ...pending, status: "approved" }, input, "app_other")).toEqual({ kind: "error", error: "invalid_grant" });
  });

  it("lehnt ab: ausstehend, abgelehnt, abgelaufen, unbekannt oder schon abgeholt", () => {
    expect(tokenResult(pending, input, "app_abc")).toEqual({ kind: "error", error: "slow_down" });
    expect(tokenResult({ ...pending, status: "denied" }, input, "app_abc")).toEqual({ kind: "error", error: "access_denied" });
    expect(tokenResult({ ...pending, expiresAt: new Date(Date.now() - 1) }, input, "app_abc")).toEqual({ kind: "error", error: "expired_token" });
    expect(tokenResult(null, input, "app_abc")).toEqual({ kind: "error", error: "invalid_grant" });
    expect(tokenResult({ ...pending, status: "claimed" }, input, "app_abc")).toEqual({ kind: "error", error: "invalid_grant" });
  });
});

describe("oauthReturnUrl", () => {
  it("kehrt zur Programm-Seite zurück – mit Code und state", () => {
    const url = oauthReturnUrl("https://chatgpt.com/connector_platform_oauth_redirect", "der-code", "probe123");
    expect(url.startsWith("https://chatgpt.com/connector_platform_oauth_redirect?")).toBe(true);
    expect(url).toContain("code=der-code");
    expect(url).toContain("state=probe123");
  });

  it("ohne Code: access_denied statt Code (Ablehnung, RFC 6749 Abschnitt 4.1.2.1)", () => {
    const url = new URL(oauthReturnUrl("https://cli/callback", null, "s1"));
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("code")).toBeNull();
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("bestehende Parameter der Redirect-Adresse bleiben erhalten", () => {
    const url = new URL(oauthReturnUrl("https://cli/callback?layout=compact", "c", null));
    expect(url.searchParams.get("layout")).toBe("compact");
    expect(url.searchParams.get("code")).toBe("c");
  });
});

describe("authorizeSchema", () => {
  it("trennt Scope-Toleranz (#141): fremde Scopes werden zugeordnet, statt die Autorisierung abzulehnen", () => {
    const base = { response_type: "code", client_id: "app_abc", redirect_uri: "https://cli/callback", code_challenge: "c".repeat(43) };
    // ChatGPT schickt z. B. "mcp" oder "openid profile email mcp" – gehört zu "tasks"
    const parsed = authorizeSchema.parse({ ...base, scope: "mcp" });
    expect(parsed.scope).toBe("tasks");
    expect(authorizeSchema.parse({ ...base, scope: "openid profile email mcp" }).scope).toBe("tasks");
    // "all" bleibt Schreiben – auch in gemischten Listen
    expect(authorizeSchema.parse({ ...base, scope: "all" }).scope).toBe("all");
    expect(authorizeSchema.parse({ ...base, scope: "read all" }).scope).toBe("all");
    // ohne Scope: Standard
    expect(authorizeSchema.parse(base).scope).toBe("tasks");
  });
});

describe("authorizeView", () => {
  it("baut den Auftrag für die Freigabe-Seite", () => {
    const view = authorizeView({ response_type: "code", client_id: "app_abc", redirect_uri: "https://cli/callback", scope: "tasks", state: "xyz", code_challenge: "c".repeat(43), code_challenge_method: "S256" });
    expect(view).toEqual({ clientId: "app_abc", redirectUri: "https://cli/callback", scope: "tasks", codeChallenge: "c".repeat(43), state: "xyz" });
  });
});
