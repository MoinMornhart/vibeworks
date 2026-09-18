import { describe, expect, it } from "vitest";
import { issueBody, workersFromIssue } from "./issues";

describe("Wer arbeitet am Issue?", () => {
  it("Bearbeiter-Labels und Zuweisungen, ohne Doppelte", () => {
    expect(workersFromIssue({ labels: ["in Arbeit", "🤖 Claude", "bug"], assignees: ["moinmornhart"] })).toEqual(["Claude", "@moinmornhart"]);
    expect(workersFromIssue({ labels: ["👤 anna", "👤 anna"], assignees: [] })).toEqual(["anna"]);
    expect(workersFromIssue({ labels: ["🤖", "feature"], assignees: [] })).toEqual([]);
    expect(workersFromIssue({ labels: ["Arbeiter Claude", "Bughunter anna"], assignees: [] })).toEqual(["Claude", "anna"]);
    expect(workersFromIssue({ labels: [], assignees: [] })).toEqual([]);
  });

  it("der eingetragene Bearbeiter steht im Issue-Text", () => {
    const base = { id: "t1", description: "Text", labels: [], dueDate: null, recurrence: null, createdByName: null, createdVia: null };
    expect(issueBody({ ...base, assignee: "Claude" })).toContain("👤 Bearbeitet von: Claude");
    expect(issueBody({ ...base, assignee: null })).not.toContain("Bearbeitet von");
  });

  it("eine besondere Priorität steht im Issue-Text, normale nicht", () => {
    const base = { id: "t1", description: "Text", labels: [], dueDate: null, recurrence: null, createdByName: null, createdVia: null, assignee: null };
    expect(issueBody({ ...base, priority: 4 })).toContain("🔥 Priorität:");
    expect(issueBody({ ...base, priority: 3 })).toContain("⬆️ Priorität:");
    expect(issueBody({ ...base, priority: 2 })).not.toContain("Priorität");
  });

  it("wer die Aufgabe in VibeWorks angelegt hat, steht im Issue", () => {
    const base = { id: "t1", description: null, labels: [], dueDate: null, recurrence: null, assignee: null };
    expect(issueBody({ ...base, createdByName: "anna", createdVia: "web" })).toContain("✍️ Erstellt von: anna in VibeWorks");
    expect(issueBody({ ...base, createdByName: "anna", createdVia: "mcp" })).toContain("anna in VibeWorks (per KI über MCP)");
    expect(issueBody({ ...base, createdByName: null, createdVia: "auto" })).toContain("Automatisch von VibeWorks angelegt");
    expect(issueBody({ ...base, createdByName: null, createdVia: null })).not.toContain("✍️");
  });
});
