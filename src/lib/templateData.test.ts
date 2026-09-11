import { describe, expect, it } from "vitest";
import { BUILTINS, builtinTemplates, templateDataSchema } from "./templateData";

describe("eingebaute Vorlagen", () => {
  it("haben auf Deutsch und Englisch dieselbe Form", () => {
    for (const b of BUILTINS) {
      expect(b.en.tasks.length, b.id).toBe(b.de.tasks.length);
      expect(b.en.notes.length, b.id).toBe(b.de.notes.length);
      expect(b.en.tags.length, b.id).toBe(b.de.tags.length);
    }
  });

  it("sind gültige Vorlagendaten mit eindeutigen IDs", () => {
    for (const locale of ["de", "en"] as const) {
      const list = builtinTemplates(locale);
      expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
      for (const t of list) {
        expect(t.id.startsWith("builtin:")).toBe(true);
        expect(templateDataSchema.safeParse(t.data).success, t.id).toBe(true);
      }
    }
  });

  it("sprechen die gewählte Sprache", () => {
    expect(builtinTemplates("de")[0].name).toBe("Web-App");
    expect(builtinTemplates("en")[0].name).toBe("Web app");
  });
});
