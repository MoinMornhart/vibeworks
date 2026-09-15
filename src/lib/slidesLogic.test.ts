import { describe, expect, it } from "vitest";
import { buildSlides, MAX_SECTIONS, MAX_SECTION_TEXT, splitDescription, type SlideInput } from "./slidesLogic";

const base: SlideInput = {
  name: "Wetter-App",
  summary: "Regen oder Sonne?",
  description: null,
  owner: "anna",
  status: "IN_PROGRESS",
  progress: 40,
  tags: ["pwa"],
  tasks: { todo: 2, doing: 1, blocked: 0, done: 3 },
  nextTasks: [],
  commits: [],
  liveUrl: null,
  repoUrl: null,
  cover: null,
};

describe("splitDescription", () => {
  it("teilt an Überschriften, Text davor wird ein eigener Abschnitt", () => {
    expect(splitDescription("Einleitung\r\n\r\n## Idee\nKurz.\n\n# Technik\nNext.js")).toEqual([
      { title: null, body: "Einleitung" },
      { title: "Idee", body: "Kurz." },
      { title: "Technik", body: "Next.js" },
    ]);
  });
  it("Codeblöcke bleiben ganz, ### ist keine neue Folie", () => {
    const parts = splitDescription("## Code\n```sh\n# kein Titel\nnpm i\n```\n### Unterpunkt\ntext");
    expect(parts).toHaveLength(1);
    expect(parts[0].body).toContain("# kein Titel");
    expect(parts[0].body).toContain("### Unterpunkt");
  });
  it("leer, zu viele und zu lange Abschnitte", () => {
    expect(splitDescription(null)).toEqual([]);
    expect(splitDescription("   ")).toEqual([]);
    expect(splitDescription(Array.from({ length: 12 }, (_, i) => `## A${i}\nx`).join("\n"))).toHaveLength(MAX_SECTIONS);
    expect(splitDescription(`## Lang\n${"x".repeat(5000)}`)[0].body).toHaveLength(MAX_SECTION_TEXT);
  });
});

describe("buildSlides", () => {
  it("nur das Nötigste: Titel, Stand, Schluss", () => {
    expect(buildSlides(base).map((s) => s.kind)).toEqual(["title", "progress", "end"]);
  });
  it("alles da: Abschnitte, Commits, Live, nächste Schritte", () => {
    const slides = buildSlides({
      ...base,
      description: "## Idee\na\n## Technik\nb",
      commits: [{ title: "Start", author: "anna", date: "2026-09-15T10:00:00Z" }],
      liveUrl: "https://wetter.example",
      repoUrl: "git@github.com:a/b.git",
      nextTasks: ["Icons"],
    });
    expect(slides.map((s) => s.kind)).toEqual(["title", "section", "section", "progress", "commits", "live", "next", "end"]);
    // SSH-Adressen sind kein Link
    expect(slides.at(-1)).toMatchObject({ kind: "end", repoUrl: null, liveUrl: "https://wetter.example" });
  });
});
