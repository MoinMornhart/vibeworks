import { describe, expect, it } from "vitest";
import { buildPrefixQuery, foldText, likePattern, matchesAll, mergeHits, splitHighlights } from "./search";

describe("buildPrefixQuery", () => {
  it("baut Präfixsuche aus Wörtern", () => {
    expect(buildPrefixQuery("Webhook Rechnung")).toBe("webhook:* & rechnung:*");
    expect(buildPrefixQuery("  Größe  ")).toBe("größe:*");
  });

  it("lässt keine tsquery-Operatoren durch", () => {
    expect(buildPrefixQuery("a' | !b & (c) <-> d:*")).toBeNull();
    expect(buildPrefixQuery("foo' | bar")).toBe("foo:* & bar:*");
  });

  it("ignoriert Einzelzeichen und begrenzt die Länge", () => {
    expect(buildPrefixQuery("x")).toBeNull();
    expect(buildPrefixQuery("aa bb cc dd ee ff gg hh")?.split("&")).toHaveLength(6);
  });
});

describe("splitHighlights", () => {
  it("trennt Fundstellen vom Rest", () => {
    expect(splitHighlights("Der ⟦Webhook⟧ feuert bei ⟦Webhooks⟧")).toEqual([
      { text: "Der ", hit: false },
      { text: "Webhook", hit: true },
      { text: " feuert bei ", hit: false },
      { text: "Webhooks", hit: true },
    ]);
  });

  it("behandelt HTML als Text", () => {
    expect(splitHighlights("<b>⟦x⟧</b>").map((p) => p.text).join("")).toBe("<b>x</b>");
  });
});

describe("Teilwort-Suche (#109)", () => {
  it("nimmt das längste Wort ab drei Zeichen", () => {
    expect(likePattern("ci hook")).toBe("hook");
    expect(likePattern("a b")).toBeNull();
    expect(likePattern("next.js 100%")).toBe("next.js");
  });

  it("führt Treffer ohne Doppelte zusammen", () => {
    expect(mergeHits([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }, { id: "c" }, { id: "d" }], 3)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("vergleicht ohne Akzente und in beliebiger Reihenfolge", () => {
    expect(foldText("Größe Café")).toBe("grosse cafe");
    expect(matchesAll("cafe gross", ["Größe", "Café am Markt"])).toBe(true);
    expect(matchesAll("wetter app", ["Wetter-App"])).toBe(true);
    expect(matchesAll("wetter bot", ["Wetter-App"])).toBe(false);
    expect(matchesAll("  ", ["x"])).toBe(true);
  });
});
