import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER, keySettingsSchema, reminderFor, toolAllowed } from "./keySettings";

const read = { name: "list_tasks", annotations: { readOnlyHint: true } };
const task = { name: "update_task" };
const other = { name: "update_project" };
const rules = { name: "confirm_agent_rules" };

describe("Einstellungen je MCP-Schlüssel", () => {
  it("„alles“ erlaubt alles", () => {
    for (const t of [read, task, other, rules]) expect(toolAllowed(t, "all")).toBe(true);
  });

  it("„tasks“: lesen und Aufgaben, sonst nichts", () => {
    expect(toolAllowed(read, "tasks")).toBe(true);
    expect(toolAllowed(task, "tasks")).toBe(true);
    expect(toolAllowed(other, "tasks")).toBe(false);
  });

  it("„read“: nur lesen – die Regeln gehen immer", () => {
    expect(toolAllowed(read, "read")).toBe(true);
    expect(toolAllowed(task, "read")).toBe(false);
    expect(toolAllowed(rules, "read")).toBe(true);
    expect(toolAllowed(other, "unbekannt")).toBe(false);
  });

  it("erinnert bei jedem n-ten Aufruf", () => {
    const s = { reminderMode: "default", reminderText: null, reminderEvery: 3 };
    expect([1, 2, 3, 4, 5, 6].map((n) => reminderFor(s, n) !== null)).toEqual([false, false, true, false, false, true]);
    expect(reminderFor(s, 3)).toBe(DEFAULT_REMINDER);
  });

  it("eigener Text, aus, und leerer eigener Text fällt auf den Standard zurück", () => {
    expect(reminderFor({ reminderMode: "custom", reminderText: "Immer auf Deutsch antworten", reminderEvery: 1 }, 1)).toBe("VibeWorks reminder from the user: Immer auf Deutsch antworten");
    expect(reminderFor({ reminderMode: "custom", reminderText: "  ", reminderEvery: 1 }, 1)).toBe(DEFAULT_REMINDER);
    expect(reminderFor({ reminderMode: "off", reminderText: null, reminderEvery: 1 }, 1)).toBeNull();
    expect(reminderFor({ reminderMode: "default", reminderText: null, reminderEvery: 0 }, 10)).toBe(DEFAULT_REMINDER);
  });

  it("prüft die Eingaben", () => {
    expect(keySettingsSchema.safeParse({ scope: "admin" }).success).toBe(false);
    expect(keySettingsSchema.safeParse({ reminderEvery: 0 }).success).toBe(false);
    expect(keySettingsSchema.parse({ scope: "read", reminderMode: "custom", reminderText: " Hallo ", reminderEvery: 5 })).toEqual({ scope: "read", reminderMode: "custom", reminderText: "Hallo", reminderEvery: 5 });
  });
});
