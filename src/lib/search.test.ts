import { describe, expect, it } from "vitest";
import { buildPrefixQuery, splitHighlights } from "./search";

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
