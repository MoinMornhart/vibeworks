import { describe, expect, it } from "vitest";
import { AGENT_TARGETS, agentFile, agentFilesIn, isAgentTarget } from "./agentFileLogic";

describe("KI-Anleitungsdateien (#107)", () => {
  it("richtiger Pfad und Kopf je Werkzeug", () => {
    expect(agentFile("claude", "# X\n\n", "d")).toEqual({ path: "CLAUDE.md", content: "# X\n" });
    expect(agentFile("agents", "# X", "d").path).toBe("AGENTS.md");
    expect(agentFile("copilot", "# X", "d").path).toBe(".github/copilot-instructions.md");
    const cursor = agentFile("cursor", "# X", 'Projekt "A"\nzweite Zeile');
    expect(cursor.path).toBe(".cursor/rules/vibeworks.mdc");
    expect(cursor.content).toBe(`---\ndescription: "Projekt 'A' zweite Zeile"\nalwaysApply: true\n---\n\n# X\n`);
    expect(agentFile("windsurf", "# X", "d").content.startsWith("---\ntrigger: always_on\n")).toBe(true);
    expect(AGENT_TARGETS.every((t) => agentFile(t, "# X", "d").content.includes("# X"))).toBe(true);
    expect(isAgentTarget("cursor")).toBe(true);
    expect(isAgentTarget("vim")).toBe(false);
  });

  it("erkennt Anleitungen aller Werkzeuge im Repository", () => {
    const files = ["README.md", "AGENTS.md", "docs/CLAUDE.md", ".github/copilot-instructions.md", ".cursor/rules/base.mdc", ".clinerules", ".windsurfrules", "src/agents.md.ts", ".github/workflows/ci.yml"];
    expect(agentFilesIn(files)).toEqual(["AGENTS.md", "docs/CLAUDE.md", ".github/copilot-instructions.md", ".cursor/rules/base.mdc", ".clinerules", ".windsurfrules"]);
    expect(agentFilesIn(["README.md", "package.json"])).toEqual([]);
  });
});
