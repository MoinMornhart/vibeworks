import { describe, expect, it } from "vitest";
import { combineShared, ntfyPollUrl, parseNtfyLines, splitIdea } from "./inbox";

describe("Ideen-Eingang", () => {
  it("erste Zeile wird Name, Rest und Link Beschreibung", () => {
    expect(splitIdea("Pflanzen-App\nmit Feuchtesensor", "https://x.de")).toEqual({ name: "Pflanzen-App", description: "mit Feuchtesensor\n\nhttps://x.de" });
    expect(splitIdea("Nur ein Satz")).toEqual({ name: "Nur ein Satz", description: null });
    const long = splitIdea("x".repeat(150));
    expect(long.name.length).toBe(118);
    expect(long.description?.length).toBe(150);
  });

  it("Geteiltes zusammenführen, Link aus dem Text ziehen", () => {
    expect(combineShared({ title: "Artikel", text: "Lies mal https://example.com/a", url: null })).toEqual({ text: "Artikel\nLies mal", url: "https://example.com/a" });
    expect(combineShared({ title: "Gleich", text: "Gleich" })).toEqual({ text: "Gleich", url: null });
    expect(combineShared({ url: "https://y.de" })).toEqual({ text: "https://y.de", url: "https://y.de" });
  });

  it("ntfy: Abfrage-Adresse und Nachrichten", () => {
    expect(ntfyPollUrl("https://ntfy.sh/meine-ideen", null)).toBe("https://ntfy.sh/meine-ideen/json?poll=1&since=5m");
    expect(ntfyPollUrl("https://ntfy.sh/meine-ideen", "abc123")).toBe("https://ntfy.sh/meine-ideen/json?poll=1&since=abc123");
    expect(ntfyPollUrl("kaputt", null)).toBeNull();
    const body = [
      JSON.stringify({ id: "o1", event: "open" }),
      JSON.stringify({ id: "m1", event: "message", message: "Idee eins" }),
      "kaputt",
      JSON.stringify({ id: "m2", event: "message", title: "Titel", message: "Text", click: "https://z.de" }),
      "",
    ].join("\n");
    expect(parseNtfyLines(body)).toEqual([
      { id: "m1", text: "Idee eins", url: null },
      { id: "m2", text: "Titel\nText", url: "https://z.de" },
    ]);
  });
});
