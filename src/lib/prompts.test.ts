import { describe, expect, it } from "vitest";
import { fillPrompt, STARTER_PROMPTS } from "./prompts";
import { buildClaudeMd } from "./claudeMd";
import { makeT } from "./i18n/messages";

const ctx = { name: "Wetterstation", repoUrl: "https://github.com/a/wetter", liveUrl: null, summary: "Sensoren im Garten" };

describe("Platzhalter", () => {
  it("setzt Projekt, Repo, Live und Kurzbeschreibung ein", () => {
    expect(fillPrompt("Arbeite an {{projekt}} ({{ repo }}) – {{summary}}", ctx)).toBe("Arbeite an Wetterstation (https://github.com/a/wetter) – Sensoren im Garten");
    expect(fillPrompt("{{project}} / {{live}}", ctx)).toBe("Wetterstation / ");
  });

  it("Unbekanntes bleibt, ohne Projekt bleibt alles", () => {
    expect(fillPrompt("{{foo}} {{projekt}}", ctx)).toBe("{{foo}} Wetterstation");
    expect(fillPrompt("{{projekt}}", null)).toBe("{{projekt}}");
  });

  it("Beispiele in beiden Sprachen", () => {
    expect(STARTER_PROMPTS.de).toHaveLength(STARTER_PROMPTS.en.length);
  });
});

describe("CLAUDE.md mit Aufbau (#101)", () => {
  it("setzt die Aufbau-Tabelle vor die Aufgaben", () => {
    const md = buildClaudeMd(
      {
        name: "X", summary: null, description: null, status: "OPEN", priority: 2, progress: 0, tags: [], repoUrl: null, liveUrl: null, issueSync: false, url: "u", tasks: [], notes: [],
        structure: { overview: "Next.js", rows: [{ area: "API", path: "src/app/api/", purpose: "Endpunkte", how: "" }], updatedAt: null, updatedBy: null },
      },
      makeT("de", "prompts"),
      makeT("de", "status"),
    );
    expect(md).toContain("## Aufbau\n\nNext.js\n\n| Bereich | Pfad | Zweck | So funktioniert’s |");
    expect(md.indexOf("## Aufbau")).toBeLessThan(md.indexOf("## Offene Aufgaben"));
    expect(md).toContain("list_workflows");
  });
});

describe("CLAUDE.md", () => {
  const md = buildClaudeMd(
    {
      name: "Wetterstation",
      summary: "Sensoren im Garten",
      description: "Ein ESP32 misst Temperatur.",
      status: "IN_PROGRESS",
      priority: 3,
      progress: 40,
      tags: ["iot"],
      repoUrl: "https://github.com/a/wetter",
      liveUrl: null,
      issueSync: true,
      url: "https://vw.example.de/projects/p1",
      tasks: [
        { title: "Akku prüfen", status: "DOING", dueDate: new Date("2026-09-14T12:00:00Z"), issueNumber: 12, description: "Spannung   messen" },
        { title: "Gehäuse", status: "TODO", dueDate: null, issueNumber: null, description: null },
        { title: "Alt", status: "DONE", dueDate: null, issueNumber: null, description: null },
      ],
      notes: [
        { title: "Entscheidung", content: "Wir nehmen MQTT.", pinned: true },
        { title: null, content: "Idee: Solarpanel\nmehr Text", pinned: false },
      ],
    },
    makeT("de", "prompts"),
    makeT("de", "status"),
  );

  it("enthält Kopf, Stand, Aufgaben nach Spalte, Notizen und Arbeitsweise", () => {
    expect(md.startsWith("# Wetterstation\n\n> Sensoren im Garten\n\nEin ESP32 misst Temperatur.")).toBe(true);
    expect(md).toContain("In Entwicklung");
    expect(md).toContain("- Repository: https://github.com/a/wetter");
    expect(md).toContain("### In Arbeit\n\n- [ ] Akku prüfen (fällig 2026-09-14 · #12)\n  Spannung messen");
    expect(md).toContain("- [ ] Gehäuse");
    expect(md).not.toContain("Alt");
    expect(md).toContain("### Entscheidung\n\nWir nehmen MQTT.");
    expect(md).toContain("- Idee: Solarpanel");
    expect(md).toContain("Fixes #n");
    expect(md.endsWith("\n")).toBe(true);
    expect(md).not.toMatch(/\n{3,}/);
  });
});
