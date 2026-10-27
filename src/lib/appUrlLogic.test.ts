import { describe, expect, it } from "vitest";
import { adoptAppUrl, effectiveAppUrl, originOf } from "./appUrlLogic";

describe("originOf", () => {
  it("nimmt Schema, Host und Port", () => {
    expect(originOf("https://vibeworks.example.de")).toBe("https://vibeworks.example.de");
    expect(originOf("http://192.168.1.50:3000")).toBe("http://192.168.1.50:3000");
    expect(originOf("https://VibeWorks.Example.DE/")).toBe("https://vibeworks.example.de");
    expect(originOf("https://example.de:443")).toBe("https://example.de");
  });

  it.each([null, undefined, "", "null", "vibeworks.example.de", "ftp://example.de", "javascript:alert(1)", "https://user:pw@example.de", "https://example.de/pfad", "https://example.de/?a=1", "https://example.de/#x"])(
    "lehnt %s ab",
    (bad) => {
      expect(originOf(bad)).toBeNull();
    },
  );
});

describe("effectiveAppUrl", () => {
  const env = "http://192.168.1.50:3000";

  it("nimmt ohne gespeicherte Adresse die .env", () => {
    expect(effectiveAppUrl(env, null)).toBe(env);
    expect(effectiveAppUrl(env, { appUrl: null, appUrlEnv: null })).toBe(env);
  });

  it("nimmt die übernommene Adresse, solange die .env gleich ist", () => {
    expect(effectiveAppUrl(env, { appUrl: "https://vibeworks.example.de", appUrlEnv: env })).toBe("https://vibeworks.example.de");
  });

  it("lässt eine geänderte .env gewinnen (Rettungsweg)", () => {
    expect(effectiveAppUrl("http://10.0.0.5:3000", { appUrl: "https://vibeworks.example.de", appUrlEnv: env })).toBe("http://10.0.0.5:3000");
  });
});

describe("adoptAppUrl", () => {
  const env = "http://192.168.1.50:3000";

  it("merkt sich die neue Adresse samt .env-Wert", () => {
    expect(adoptAppUrl("https://vibeworks.example.de", env)).toEqual({ appUrl: "https://vibeworks.example.de", appUrlEnv: env });
  });

  it("räumt auf, wenn die Adresse wieder der .env entspricht", () => {
    expect(adoptAppUrl(env, env)).toEqual({ appUrl: null, appUrlEnv: null });
    expect(adoptAppUrl("https://example.de", "https://Example.de")).toEqual({ appUrl: null, appUrlEnv: null });
  });
});
