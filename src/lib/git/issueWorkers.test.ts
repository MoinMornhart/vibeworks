import { describe, expect, it } from "vitest";
import { issueBody, workersFromIssue } from "./issues";

describe("Wer arbeitet am Issue?", () => {
  it("Bearbeiter-Labels und Zuweisungen, ohne Doppelte", () => {
    expect(workersFromIssue({ labels: ["in Arbeit", "🤖 Claude", "bug"], assignees: ["moinmornhart"] })).toEqual(["Claude", "@moinmornhart"]);
    expect(workersFromIssue({ labels: ["👤 anna", "👤 anna"], assignees: [] })).toEqual(["anna"]);
    expect(workersFromIssue({ labels: ["🤖", "feature"], assignees: [] })).toEqual([]);
    expect(workersFromIssue({ labels: [], assignees: [] })).toEqual([]);
  });

  it("der eingetragene Bearbeiter steht im Issue-Text", () => {
    const base = { id: "t1", description: "Text", labels: [], dueDate: null, recurrence: null };
    expect(issueBody({ ...base, assignee: "Claude" })).toContain("👤 Bearbeitet von: Claude");
    expect(issueBody({ ...base, assignee: null })).not.toContain("Bearbeitet von");
  });
});
