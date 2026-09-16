import { describe, expect, it } from "vitest";
import { agentRules, CONFIRM_TOOL, RULES_REMINDER, RULES_TOOL } from "./agentRules";

const tools = [
  { name: "list_projects", title: "List projects", description: "All projects the user can see. Includes shared ones." },
  { name: "update_task", title: "Update task", description: "Move a task. Only the given fields change." },
];

describe("Regeln für KI-Agenten", () => {
  const md = agentRules(tools, "https://vw.example");

  it("ist eine Skill-Datei mit Frontmatter", () => {
    expect(md.startsWith("---\nname: vibeworks\ndescription: ")).toBe(true);
    expect(md).toContain("~/.claude/skills/vibeworks/SKILL.md");
    expect(md).toContain("AGENTS.md");
  });

  it("listet genau die übergebenen Werkzeuge, jeweils mit dem ersten Satz", () => {
    expect(md).toContain("## Available tools (2)");
    expect(md).toContain("- `list_projects` – List projects: All projects the user can see.");
    expect(md).not.toContain("Includes shared ones");
  });

  it("verlangt Einträge in der Sprache des Kontos und den Blick auf offene Aufgaben (#74)", () => {
    expect(md).toContain("in German, the user's language");
    expect(agentRules(tools, "https://vw.example", "en")).toContain("in English, the user's language");
    expect(md).toContain("Never end a reply without having used VibeWorks");
  });

  it("verweist auf Bestätigung und Adresse", () => {
    expect(md).toContain(CONFIRM_TOOL);
    expect(md).toContain("https://vw.example");
    expect(RULES_REMINDER).toContain(RULES_TOOL);
  });
});
