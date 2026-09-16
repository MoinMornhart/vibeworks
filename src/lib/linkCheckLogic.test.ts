import { describe, expect, it } from "vitest";
import { checkLink, guardedHref, mayAutoContinue } from "./linkCheckLogic";

const APP = "https://vibeworks.example";

describe("Link-Prüfung (#65)", () => {
  it("unterscheidet intern, extern und gesperrt", () => {
    expect(checkLink("/projects/1", APP)).toMatchObject({ kind: "internal", url: "/projects/1" });
    expect(checkLink("https://vibeworks.example/docs?x=1#a", APP)).toMatchObject({ kind: "internal", url: "/docs?x=1#a" });
    expect(checkLink("https://github.com/o/r", APP)).toMatchObject({ kind: "external", host: "github.com", warnings: [] });
    expect(checkLink("javascript:alert(1)", APP).kind).toBe("blocked");
    expect(checkLink("data:text/html,x", APP).kind).toBe("blocked");
    expect(checkLink("file:///etc/passwd", APP).kind).toBe("blocked");
  });

  it("findet Auffälligkeiten", () => {
    expect(checkLink("http://192.168.0.10:3000/x", APP).warnings).toEqual(expect.arrayContaining(["http", "ip", "port"]));
    expect(checkLink("https://xn--pypal-4ve.com", APP).warnings).toContain("punycode");
    expect(checkLink("https://bit.ly/abc", APP).warnings).toContain("shortener");
    expect(checkLink("https://github.com@evil.example/login", APP).warnings).toContain("credentials");
    expect(checkLink("https://github-login.example/", APP).warnings).toContain("lookalike");
    expect(checkLink("https://docs.github.com/", APP).warnings).not.toContain("lookalike");
    expect(checkLink("https://update.zip/", APP).warnings).toContain("tld");
    expect(checkLink("https://a.b.c.d.e.example.com/", APP).warnings).toContain("subdomains");
  });

  it("baut Links für Markdown", () => {
    expect(guardedHref("https://github.com/o/r?a=1&b=2", APP)).toBe(`/go?to=${encodeURIComponent("https://github.com/o/r?a=1&b=2")}`);
    expect(guardedHref("/tasks", APP)).toBe("/tasks");
    expect(guardedHref("javascript:x", APP)).toBeNull();
  });

  it("leitet nur gefahrlos automatisch weiter", () => {
    const ok = checkLink("https://github.com", APP);
    const risky = checkLink("https://bit.ly/x", APP);
    expect(mayAutoContinue(checkLink("/docs", APP), false, false)).toBe(true);
    expect(mayAutoContinue(ok, true, true)).toBe(true);
    expect(mayAutoContinue(ok, true, false)).toBe(false);
    expect(mayAutoContinue(ok, false, true)).toBe(false);
    expect(mayAutoContinue(risky, true, true)).toBe(false);
  });
});
